from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.routers.documents import MAX_SAVED_MESSAGES
from tests.factories import PILOT, sign_up

MESSAGES = [
    {"role": "assistant", "content": "Hi! What would you like to create?"},
    {"role": "user", "content": "A pilot for Acme and Globex."},
    {"role": "assistant", "content": "A Pilot Agreement it is. What is the product?"},
]


def body(document_id: str | None = "pilot", fields: dict[str, str] | None = None, messages=MESSAGES) -> dict[str, Any]:
    return {"draft": {"documentId": document_id, "fields": PILOT if fields is None else fields}, "messages": messages}


def create(client: TestClient, **kwargs: Any) -> dict[str, Any]:
    response = client.post("/api/documents", json=body(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def test_saving_a_document_and_reading_it_back(signed_in: TestClient) -> None:
    created = create(signed_in)
    assert created["id"] > 0
    assert created["documentId"] == "pilot"
    assert created["documentName"] == "Pilot Agreement"
    assert created["title"] == "Acme Inc. / Globex LLC"
    assert created["draft"] == {"documentId": "pilot", "fields": PILOT}
    assert created["messages"] == MESSAGES
    assert created["createdAt"] == created["updatedAt"]

    assert signed_in.get(f"/api/documents/{created['id']}").json() == created


def test_updating_a_document(signed_in: TestClient) -> None:
    created = create(signed_in)
    more = [*MESSAGES, {"role": "user", "content": "Acme Analytics."}]
    # The AI may switch documents mid-conversation: it is still the same saved document.
    response = signed_in.put(
        f"/api/documents/{created['id']}", json=body("csa", {"party1Company": "Acme Inc."}, more)
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["documentName"] == "Cloud Service Agreement"
    assert updated["title"] == "Acme Inc."
    assert updated["messages"] == more
    assert updated["createdAt"] == created["createdAt"]
    assert updated["updatedAt"] > created["updatedAt"]


def test_the_list_is_newest_first_without_the_conversation(signed_in: TestClient) -> None:
    first = create(signed_in)
    second = create(signed_in, document_id="csa", fields={})
    signed_in.put(f"/api/documents/{first['id']}", json=body())

    response = signed_in.get("/api/documents")
    assert response.status_code == 200
    documents = response.json()["documents"]
    assert [d["id"] for d in documents] == [first["id"], second["id"]]
    assert documents[1] == {
        "id": second["id"],
        "documentId": "csa",
        "documentName": "Cloud Service Agreement",
        "title": None,
        "createdAt": second["createdAt"],
        "updatedAt": second["updatedAt"],
    }


def test_a_new_user_has_no_documents(signed_in: TestClient) -> None:
    assert signed_in.get("/api/documents").json() == {"documents": []}


def test_deleting_a_document(signed_in: TestClient) -> None:
    created = create(signed_in)
    assert signed_in.delete(f"/api/documents/{created['id']}").status_code == 204
    assert signed_in.get(f"/api/documents/{created['id']}").status_code == 404
    assert signed_in.get("/api/documents").json() == {"documents": []}


def test_users_only_see_their_own_documents(client: TestClient) -> None:
    sign_up(client, "ada@acme.test")
    adas = create(client)
    client.post("/api/auth/signout")
    sign_up(client, "bob@acme.test")

    assert client.get("/api/documents").json() == {"documents": []}
    # Someone else's document is simply not found: its existence isn't revealed.
    path = f"/api/documents/{adas['id']}"
    for response in (client.get(path), client.put(path, json=body()), client.delete(path)):
        assert response.status_code == 404
        assert response.json() == {"detail": "Document not found."}

    client.post("/api/auth/signout")
    client.post("/api/auth/signin", json={"email": "ada@acme.test", "password": "correct horse battery"})
    assert client.get(path).json() == adas


def test_unknown_documents_are_not_found(signed_in: TestClient) -> None:
    assert signed_in.get("/api/documents/999").status_code == 404
    assert signed_in.put("/api/documents/999", json=body()).status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "/api/documents"), ("post", "/api/documents"), ("get", "/api/documents/1"),
     ("put", "/api/documents/1"), ("delete", "/api/documents/1")],
)
def test_every_route_needs_a_signed_in_user(client: TestClient, method: str, path: str) -> None:
    kwargs = {"json": body()} if method in ("post", "put") else {}
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in."}


def test_a_draft_without_a_document_is_not_saved(signed_in: TestClient) -> None:
    response = signed_in.post("/api/documents", json=body(document_id=None, fields={}))
    assert response.status_code == 422


def test_an_unknown_document_type_is_rejected(signed_in: TestClient) -> None:
    assert signed_in.post("/api/documents", json=body(document_id="nope")).status_code == 422


def test_saved_conversations_are_capped(signed_in: TestClient) -> None:
    message = {"role": "user", "content": "More."}
    at_limit = signed_in.post("/api/documents", json=body(messages=[message] * MAX_SAVED_MESSAGES))
    assert at_limit.status_code == 201
    over = signed_in.post("/api/documents", json=body(messages=[message] * (MAX_SAVED_MESSAGES + 1)))
    assert over.status_code == 422
    assert signed_in.post("/api/documents", json=body(messages=[])).status_code == 422
