"""documents.json must stay in step with the templates it describes."""

import json
import re

import pytest

from app.config import BACKEND_DIR
from app.documents.registry import DOCUMENTS, DocumentDef

ROOT = BACKEND_DIR.parent
# A reference to a term that the Cover Page defines, e.g. <span class="keyterms_link">Fees</span>.
TERM = re.compile(r'<span class="(?:coverpage|orderform|keyterms|sow|businessterms)_link"[^>]*>(.+?)</span>')


def test_covers_every_template_in_the_catalog() -> None:
    catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    catalogued = {entry["filename"] for entry in catalog["templates"]}
    # The NDA's cover page is part of the Mutual NDA entry, which has its own cover page.
    assert catalogued - {"templates/Mutual-NDA-coverpage.md"} == {d.template for d in DOCUMENTS.values()}


@pytest.mark.parametrize("document", DOCUMENTS.values(), ids=lambda d: d.id)
def test_field_keys_are_unique(document: DocumentDef) -> None:
    keys = [f.key for f in document.all_fields]
    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("document", DOCUMENTS.values(), ids=lambda d: d.id)
def test_every_term_the_template_uses_is_a_field_or_a_party(document: DocumentDef) -> None:
    template = (ROOT / document.template).read_text(encoding="utf-8")
    known = {f.label.lower() for f in document.fields} | {role.lower() for role in document.parties}
    known.add("notice address")  # each party's notice address

    def is_known(term: str) -> bool:
        term = re.sub(r"[’']s$", "", term).lower()  # Customer's -> customer
        return term in known or f"{term}s" in known or term.removesuffix("s") in known

    unknown = {term for term in TERM.findall(template) if not is_known(term)}
    assert unknown == set()


@pytest.mark.parametrize("document", DOCUMENTS.values(), ids=lambda d: d.id)
def test_fields_have_sensible_settings(document: DocumentDef) -> None:
    for field in document.fields:
        assert (field.kind == "term") == (field.open_ended is not None), field.key
        if field.default == "today":
            assert field.kind == "date", field.key
