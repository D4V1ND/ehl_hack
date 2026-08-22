from backend.outreach.router import route_channel
from packages.contracts.models import Channel


def test_german_suppliers_get_a_phone_call():
    assert route_channel("DE") is Channel.VOICE


def test_china_gets_the_marketplace_channel():
    assert route_channel("CN") is Channel.MARKETPLACE


def test_an_unsupported_region_falls_back_to_email_never_to_voice():
    assert route_channel("ZZ") is Channel.EMAIL


def test_the_country_code_is_case_insensitive():
    assert route_channel("de") is Channel.VOICE
