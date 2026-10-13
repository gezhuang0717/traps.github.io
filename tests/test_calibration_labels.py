"""Calibration label contract must survive YAML boolean-key conversion."""
from pathlib import Path
import pytest
import yaml

@pytest.mark.parametrize('language',['en','zh','fi','de','ja'])
def test_calibration_on_off_are_named_localized_strings(language):
    labels=yaml.safe_load((Path(__file__).resolve().parents[1]/'data/calibration_labels.yaml').read_text())[language]
    assert isinstance(labels['on'],str)and labels['on'].strip()
    assert isinstance(labels['off'],str)and labels['off'].strip()
    assert True not in labels and False not in labels
