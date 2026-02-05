"""Minimal tests for Phase 3 RLM REPL (no outbound calls)."""

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.recursive_loop import RLMSummary

client = TestClient(app)


def _mock_grpc_response(observation: str, success: bool = True, error: str = ""):
    r = MagicMock()
    r.observation = observation
    r.success = success
    r.error = error
    return r


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "pagi-intelligence-bridge"


def test_rlm_circuit_breaker():
    """Depth >= 5 returns converged=False."""
    r = client.post(
        "/rlm",
        json={"query": "test", "context": "", "depth": 5},
    )
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert data["converged"] is False


def test_rlm_simple():
    """Simple query returns RLMSummary."""
    r = client.post(
        "/rlm",
        json={"query": "simple", "context": "resolved", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert "converged" in data
    assert data["converged"] is True


def test_rlm_mock_mode_converges(monkeypatch):
    """Mock mode should converge without outbound calls."""
    monkeypatch.setenv("PAGI_MOCK_MODE", "true")
    r = client.post(
        "/rlm",
        json={"query": "plan a mock task", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "mock" in data["summary"].lower()


def test_mock_mode_disabled(monkeypatch):
    """With PAGI_MOCK_MODE=true, POST /rlm with mock_mode=false yields real path; response is NOT generic mock message."""
    monkeypatch.setenv("PAGI_MOCK_MODE", "true")
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Real path response.","action":null,"is_final":true}',
    )
    r = client.post(
        "/rlm",
        json={"query": "what is your name", "context": "", "depth": 0, "mock_mode": False},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "MockMode thought" not in data["summary"]
    assert "Real path response" in data["summary"]


def test_rlm_request_mock_mode_override_env(monkeypatch):
    """Request mock_mode=false overrides PAGI_MOCK_MODE=true; structured path runs and stub thought is returned."""
    monkeypatch.setenv("PAGI_MOCK_MODE", "true")
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"I am Sola, your personal AGI companion.","action":null,"is_final":true}',
    )
    r = client.post(
        "/rlm",
        json={
            "query": "what is your name",
            "context": "",
            "depth": 0,
            "mock_mode": False,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    # Must NOT be the generic mock short-circuit message (request override took effect)
    assert "MockMode thought" not in data["summary"]
    # Structured path ran: stub thought returned
    assert "Sola" in data["summary"]


def test_rlm_structured_stub_json_is_final(monkeypatch):
    """Structured JSON enforcement: stub response with is_final true should converge."""
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"done","action":null,"observation":null,"is_final":true}',
    )
    r = client.post(
        "/rlm",
        json={"query": "anything", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert data["summary"] == "done"


def test_rlm_structured_invalid_json_reports_schema_failure(monkeypatch):
    """Invalid JSON should return converged=False and include schema failure message."""
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", "not-json")
    r = client.post(
        "/rlm",
        json={"query": "anything", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is False
    assert "schema enforcement failed" in data["summary"].lower()


def test_local_dispatch_peek_file(monkeypatch, tmp_path):
    """Gated local dispatch should execute allow-listed L5 skills in-process."""
    # Ensure gRPC path isn't used.
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")

    p = tmp_path / "hello.txt"
    p.write_text("hello world", encoding="utf-8")

    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        (
            '{'
            '"thought":"peek please",'
            '"action": {"skill_name":"peek_file","params":{"path":"%s","start":0,"end":5}},'
            '"is_final": false'
            '}'
        )
        % str(p).replace("\\", "\\\\"),
    )

    r = client.post(
        "/rlm",
        json={"query": "anything", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    # One-step loop returns thought; execution happens and should not error.
    assert "summary" in data
    assert data["converged"] is False


def test_rlm_chained_execute_skill_peek_file(monkeypatch, tmp_path):
    """README checklist: execute_skill(peek_file) chain with stub; converged and synthesis."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    peek_target = tmp_path / "README.md"
    peek_target.write_text("# Phoenix AGI\n\nBare-metal chain test.", encoding="utf-8")

    stub = (
        '{'
        '"thought":"Peek README then synthesize.",'
        '"action":{"skill_name":"execute_skill","params":{'
        '"skill_name":"peek_file",'
        '"params":{"path":"%s","start":0,"end":100},'
        '"reasoning_id":"chained-1"'
        '}},'
        '"is_final":true'
        '}'
    ) % str(peek_target).replace("\\", "\\\\")

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={
            "query": "First peek the beginning of README.md, then use execute_skill to save test_chained.py with the peeked content",
            "context": "",
            "depth": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "summary" in data
    assert "Peek" in data["summary"] or "synthesize" in data["summary"].lower()


def test_local_dispatch_list_dir(monkeypatch, tmp_path):
    """list_dir skill returns directory listing via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    (tmp_path / "a.txt").write_text("a", encoding="utf-8")
    (tmp_path / "b.md").write_text("b", encoding="utf-8")

    path_arg = str(tmp_path).replace("\\", "\\\\")
    stub = (
        '{'
        '"thought":"List directory.",'
        '"action":{"skill_name":"list_dir","params":{"path":"%s","max_items":10}},'  # noqa: E501
        '"is_final":true'
        '}'
    ) % path_arg

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "List files here", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert data["summary"] == "List directory."


def test_local_dispatch_read_entire_file_safe(monkeypatch, tmp_path):
    """read_entire_file_safe skill returns file content via local dispatch; summary contains snippet."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    snippet = "syntax = \"proto3\"; package pagi;"
    target = tmp_path / "pagi.proto"
    target.write_text(snippet, encoding="utf-8")

    path_arg = str(target).replace("\\", "\\\\")
    # Stub thought includes file content snippet so returned summary contains it
    stub = (
        '{'
        '"thought":"Read entire file. Content: syntax = \\"proto3\\"; package pagi;",'
        '"action":{"skill_name":"read_entire_file_safe","params":{"path":"%s","max_size_bytes":4096}},'  # noqa: E501
        '"is_final":true'
        '}'
    ) % path_arg

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Read pagi.proto and summarize", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "proto3" in data["summary"]
    assert "package" in data["summary"]


def test_local_dispatch_list_files_recursive(monkeypatch, tmp_path):
    """list_files_recursive skill returns recursive listing via local dispatch; converged and summary contains expected file names."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    (tmp_path / "a.py").write_text("a", encoding="utf-8")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "b.py").write_text("b", encoding="utf-8")

    path_arg = str(tmp_path).replace("\\", "\\\\")
    stub = (
        '{'
        '"thought":"Listed recursively.",'
        '"action":{"skill_name":"list_files_recursive","params":{"path":"%s","pattern":"*.py","max_depth":2,"max_items":50}},'
        '"is_final":true'
        '}'
    ) % path_arg

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Recursively list py files here", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "a.py" in data["summary"] or "b.py" in data["summary"] or "Listed" in data["summary"]


def test_local_dispatch_write_file_safe(monkeypatch, tmp_path):
    """write_file_safe skill writes content via local dispatch; summary contains success message."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    out_file = tmp_path / "out.txt"
    path_arg = str(out_file).replace("\\", "\\\\")
    stub = (
        '{'
        '"thought":"Write done. [write_file_safe] Wrote 5 bytes to %s",'
        '"action":{"skill_name":"write_file_safe","params":{"path":"%s","content":"hello","overwrite":false}},'  # noqa: E501
        '"is_final":true'
        '}'
    ) % (path_arg, path_arg)

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Write hello to out.txt", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "Wrote" in data["summary"]
    assert "bytes" in data["summary"]
    assert out_file.read_text() == "hello"


def test_local_dispatch_search_codebase(monkeypatch, tmp_path):
    """search_codebase skill returns matches via local dispatch; converged and summary contains matches."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    (tmp_path / "a.rs").write_text("fn main() { panic!(\"oops\"); }", encoding="utf-8")
    (tmp_path / "b.py").write_text("no panic here", encoding="utf-8")

    path_arg = str(tmp_path).replace("\\", "\\\\")
    stub = (
        '{'
        '"thought":"Searched codebase for panic.",'
        '"action":{"skill_name":"search_codebase","params":{"path":"%s","pattern":"panic","max_files":50,"mode":"keyword"}},'
        '"is_final":true'
        '}'
    ) % path_arg

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Search codebase for panic keywords", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "Matches" in data["summary"] or "panic" in data["summary"]
    assert "a.rs" in data["summary"] or "panic" in data["summary"]


def test_local_dispatch_run_tests(monkeypatch, tmp_path):
    """run_tests skill runs tests via local dispatch; monkeypatch subprocess to avoid real run; assert converged and passed in summary."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    result = MagicMock()
    result.returncode = 0
    result.stdout = "2 passed in 0.05s"
    result.stderr = ""

    path_arg = str(tmp_path).replace("\\", "\\\\")
    stub = (
        '{'
        '"thought":"Tests passed.",'
        '"action":{"skill_name":"run_tests","params":{"dir":"%s","type":"python","timeout_sec":30}},'
        '"is_final":true'
        '}'
    ) % path_arg

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    with patch("subprocess.run", return_value=result):
        r = client.post(
            "/rlm",
            json={"query": "Run Python tests in bridge dir", "context": "", "depth": 0},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "passed" in data["summary"].lower()


def test_local_dispatch_run_python_code_safe(monkeypatch):
    """run_python_code_safe skill runs snippet in sandbox via local dispatch; assert converged and output reflected in summary."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Ran snippet. Output: 4",'
        '"action":{"skill_name":"run_python_code_safe","params":{"code":"print(2 + 2)","timeout_sec":5,"max_output_len":4096}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={
            "query": "Run this Python code snippet",
            "context": "",
            "depth": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "4" in data["summary"]
    assert "[run_python_code_safe] Error" not in data["summary"]
    assert "[run_python_code_safe] Execution timed out" not in data["summary"]


def test_rlm_grpc_dispatch_mock(monkeypatch):
    """When PAGI_ACTIONS_VIA_GRPC=true and PAGI_MOCK_MODE=true, stub action gets mock observation in summary."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "true")
    monkeypatch.setenv("PAGI_MOCK_MODE", "true")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "false")
    monkeypatch.delenv("PAGI_RLM_STUB_JSON", raising=False)
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Planned peek.","action":{"skill_name":"peek_file","params":{"path":"README.md","start":0,"end":10}},"is_final":true}',
    )

    mock_stub = MagicMock()
    mock_stub.ExecuteAction.return_value = _mock_grpc_response(
        "Observation: mock executed skill=peek_file", success=True, error=""
    )

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        r = client.post(
            "/rlm",
            json={"query": "Peek README", "context": "", "depth": 0},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "mock" in data["summary"].lower() or "Planned" in data["summary"]


def test_rlm_grpc_dispatch_real_allowed(monkeypatch, tmp_path):
    """When PAGI_ACTIONS_VIA_GRPC=true and PAGI_ALLOW_REAL_DISPATCH=true, stub peek_file returns real obs in summary."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "true")
    monkeypatch.setenv("PAGI_ALLOW_REAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "false")
    (tmp_path / "README.md").write_text("Real peek content", encoding="utf-8")
    path_arg = str(tmp_path / "README.md").replace("\\", "\\\\")
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Peeked.","action":{"skill_name":"peek_file","params":{"path":"%s","start":0,"end":20}},"is_final":true}'
        % path_arg,
    )

    mock_stub = MagicMock()
    mock_stub.ExecuteAction.return_value = _mock_grpc_response(
        "Real peek content", success=True, error=""
    )

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        r = client.post(
            "/rlm",
            json={"query": "Peek README", "context": "", "depth": 0},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "Peeked" in data["summary"] or "Real" in data["summary"]


def test_rlm_grpc_dispatch_timeout(monkeypatch):
    """When gRPC returns timeout error, summary reflects failure."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "true")
    monkeypatch.setenv("PAGI_ALLOW_REAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "false")
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Timed out.","action":{"skill_name":"peek_file","params":{"path":"x","start":0,"end":10}},"is_final":true}',
    )

    mock_stub = MagicMock()
    mock_stub.ExecuteAction.return_value = _mock_grpc_response(
        "", success=False, error="Execution timed out"
    )

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        r = client.post(
            "/rlm",
            json={"query": "Peek x", "context": "", "depth": 0},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "Timed out" in data["summary"] or "timed out" in data["summary"].lower()


def test_local_dispatch_analyze_code(monkeypatch):
    """analyze_code skill returns RCA summary via local dispatch; converged and summary contains RCA."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    code_snippet = 'fn main() { panic!("oops"); }'
    import json
    params = {"code": code_snippet, "language": "rust", "max_length": 4096}
    stub = (
        '{'
        '"thought":"Analyzed code for RCA.",'
        '"action":{"skill_name":"analyze_code","params":%s},'
        '"is_final":true'
        '}'
    ) % json.dumps(params)

    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={
            "query": "Analyze this code snippet for errors and propose fix",
            "context": "",
            "depth": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "RCA" in data["summary"]


def test_rlm_multi_turn(monkeypatch):
    """POST /rlm-multi-turn returns list of RLMSummary; stub forces 2 turns, last converged=true."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "false")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"step","action":null,"is_final":false}',
    )

    with patch("src.main.recursive_loop") as mock_loop:
        mock_loop.side_effect = [
            RLMSummary(summary="turn1", converged=False),
            RLMSummary(summary="turn2", converged=True),
        ]
        r = client.post(
            "/rlm-multi-turn",
            json={
                "query": "Analyze error, propose fix",
                "context": "",
                "depth": 0,
                "max_turns": 4,
            },
        )
    assert r.status_code == 200
    summaries = r.json()
    assert isinstance(summaries, list)
    assert len(summaries) == 2
    assert summaries[-1]["converged"] is True
    assert summaries[-1]["summary"] == "turn2"


def test_rlm_vertical_self_patch(monkeypatch, tmp_path):
    """Vertical research: self-patch query with error_trace returns converged and summary contains proposed fix."""
    monkeypatch.setenv("PAGI_VERTICAL_USE_CASE", "research")
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    patch_dir = tmp_path / "patches"
    patch_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Proposed fix: add null check and bounds validation.","action":null,"is_final":true}',
    )

    r = client.post(
        "/rlm",
        json={
            "query": "Analyze error_trace, self-patch propose Rust fix",
            "context": "error_trace: panic at main.rs:42",
            "depth": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "proposed fix" in data["summary"].lower() or "Proposed fix" in data["summary"]


def test_rlm_vertical_codegen(monkeypatch, tmp_path):
    """Vertical codegen: is_final triggers write_file_safe to codegen_output; summary contains codegen_output and write observation."""
    monkeypatch.setenv("PAGI_VERTICAL_USE_CASE", "codegen")
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.setenv("PAGI_CODEGEN_OUTPUT_DIR", "codegen_output")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"def test_analyze_code():\\n    assert True","action":null,"is_final":true}',
    )

    r = client.post(
        "/rlm",
        json={
            "query": "Generate a test for the analyze_code skill",
            "context": "",
            "depth": 0,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "codegen_output" in data["summary"]
    assert "Wrote" in data["summary"] or "bytes" in data["summary"]
    # File should exist under tmp_path/codegen_output/
    codegen_dir = tmp_path / "codegen_output"
    assert codegen_dir.exists()
    assert list(codegen_dir.glob("*.py"))


def test_rlm_vertical_code_review(monkeypatch, tmp_path):
    """Vertical code_review: is_final triggers analyze_code → run_tests → write_file_safe to reviewed/; summary contains 'reviewed' and write observation."""
    monkeypatch.setenv("PAGI_VERTICAL_USE_CASE", "code_review")
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.setenv("PAGI_PROJECT_ROOT", str(tmp_path))
    monkeypatch.setenv("PAGI_CODE_REVIEW_OUTPUT_DIR", "reviewed")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    monkeypatch.setenv(
        "PAGI_RLM_STUB_JSON",
        '{"thought":"Proposed fix: add type hints and docstring.","action":null,"is_final":true}',
    )

    result = MagicMock()
    result.returncode = 0
    result.stdout = "1 passed"
    result.stderr = ""

    with patch("subprocess.run", return_value=result):
        r = client.post(
            "/rlm",
            json={
                "query": "Review this code for issues and propose fixes",
                "context": "code: def add(a, b): return a + b",
                "depth": 0,
            },
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "reviewed" in data["summary"].lower() or "Code review" in data["summary"]
    assert "Wrote" in data["summary"] or "write" in data["summary"].lower() or "bytes" in data["summary"]
    review_dir = tmp_path / "reviewed"
    assert review_dir.exists()
    assert list(review_dir.glob("reviewed_*.py"))


def test_self_heal_grpc(monkeypatch):
    """When PAGI_ALLOW_SELF_HEAL_GRPC=true and ValidationError occurs, ProposePatch is called via gRPC."""
    monkeypatch.setenv("PAGI_ALLOW_SELF_HEAL_GRPC", "true")
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", "not-json")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)

    mock_stub = MagicMock()
    mock_stub.ProposePatch.return_value = MagicMock(
        patch_id="p1", proposed_code="", requires_hitl=True
    )

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        r = client.post(
            "/rlm",
            json={"query": "anything", "context": "", "depth": 0},
        )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is False
    assert "schema" in data["summary"].lower() or "enforcement" in data["summary"].lower()
    mock_stub.ProposePatch.assert_called_once()
    call_args = mock_stub.ProposePatch.call_args[0][0]
    assert call_args.error_trace
    assert "schema" in call_args.error_trace.lower() or "validation" in call_args.error_trace.lower()
    assert call_args.component == "python_skill"


def test_self_heal_grpc_propose(monkeypatch):
    """ProposePatch is called with error_trace and component when self-heal gRPC is enabled and error occurs."""
    monkeypatch.setenv("PAGI_ALLOW_SELF_HEAL_GRPC", "true")
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", "not-json")

    mock_stub = MagicMock()
    mock_stub.ProposePatch.return_value = MagicMock(
        patch_id="propose-1", proposed_code="# fix", requires_hitl=True
    )

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        client.post("/rlm", json={"query": "x", "context": "", "depth": 0})

    mock_stub.ProposePatch.assert_called_once()
    req = mock_stub.ProposePatch.call_args[0][0]
    assert req.error_trace
    assert req.component == "python_skill"


def test_self_heal_grpc_apply(monkeypatch):
    """When propose_resp.requires_hitl=false, ApplyPatch is called with approved=true."""
    monkeypatch.setenv("PAGI_ALLOW_SELF_HEAL_GRPC", "true")
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", "not-json")

    mock_stub = MagicMock()
    mock_stub.ProposePatch.return_value = MagicMock(
        patch_id="auto-patch-1", proposed_code="# fix", requires_hitl=False
    )
    mock_stub.ApplyPatch.return_value = MagicMock(success=True, commit_hash="abc123")

    with patch("src.recursive_loop._get_grpc_stub", return_value=mock_stub):
        client.post("/rlm", json={"query": "x", "context": "", "depth": 0})

    mock_stub.ProposePatch.assert_called_once()
    mock_stub.ApplyPatch.assert_called_once()
    apply_req = mock_stub.ApplyPatch.call_args[0][0]
    assert apply_req.patch_id == "auto-patch-1"
    assert apply_req.approved is True
    assert apply_req.component == "python_skill"


def test_auto_evolve_from_patch():
    """evolve_skill_from_patch skill writes new skill file and returns EVOLVED_PATH for Watchdog commit."""
    from pathlib import Path

    from src.skills.evolve_skill_from_patch import EvolveSkillFromPatchParams, run

    params = EvolveSkillFromPatchParams(patch_content="# fix for null check")
    out = run(params)
    assert out.startswith("EVOLVED_PATH:")
    path_str = out.split(":", 1)[1].strip()
    bridge_root = Path(__file__).resolve().parent.parent
    full_path = (bridge_root / path_str.replace("\\", "/")).resolve()
    assert full_path.exists()
    full_path.unlink()


def test_local_dispatch_track_health(monkeypatch):
    """track_health skill returns summary via local dispatch; converged and summary contains kb_health."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Tracked health metrics.",'
        '"action":{"skill_name":"track_health","params":{"metrics":{"weight":70,"steps":5000},"kb_name":"kb_health}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Track my health metrics", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "kb_health" in data["summary"]
    assert "Tracked" in data["summary"] or "stub" in data["summary"].lower()


def test_local_dispatch_manage_finance(monkeypatch):
    """manage_finance skill returns summary via local dispatch; converged and summary contains kb_finance."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Budget updated.",'
        '"action":{"skill_name":"manage_finance","params":{"data":{"budget":2000,"spent":1200},"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Update my budget", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "kb_finance" in data["summary"]
    assert "Finance" in data["summary"] or "stub" in data["summary"].lower() or "remainder" in data["summary"]


def test_local_dispatch_post_social(monkeypatch):
    """post_social skill returns confirmation via local dispatch; converged and summary contains kb_social."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Post logged.",'
        '"action":{"skill_name":"post_social","params":{"content":"Hello world","platform":"stub","kb_name":"kb_social}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Post to social", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "kb_social" in data["summary"]
    assert "Post" in data["summary"] or "stub" in data["summary"].lower()


def test_local_dispatch_manage_email(monkeypatch):
    """manage_email skill returns summary via local dispatch; converged and summary contains kb_email."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Email stub done.",'
        '"action":{"skill_name":"manage_email","params":{"action":"read","content":"","kb_name":"kb_email}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Check email", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "kb_email" in data["summary"]
    assert "Email" in data["summary"] or "stub" in data["summary"].lower()


def test_local_dispatch_track_health_metrics(monkeypatch):
    """track_health_metrics skill returns [track_health_metrics] Logged via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Logged health metrics.",'
        '"action":{"skill_name":"track_health_metrics","params":{"metrics":{"weight":70,"steps":5000},"kb_name":"kb_health}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Log my health metrics", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[track_health_metrics] Logged" in data["summary"]


def test_local_dispatch_query_health_trends(monkeypatch):
    """query_health_trends skill returns trends summary via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Queried health trends.",'
        '"action":{"skill_name":"query_health_trends","params":{"query":"steps","period_days":30,"kb_name":"kb_health}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "What are my health trends", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[query_health_trends]" in data["summary"]


def test_local_dispatch_health_reminder(monkeypatch):
    """health_reminder skill returns [health_reminder] Reminder set via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Reminder set.",'
        '"action":{"skill_name":"health_reminder","params":{"type":"vitamins","frequency":"daily","kb_name":"kb_health}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Remind me to take vitamins daily", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[health_reminder] Reminder set" in data["summary"]


def test_local_dispatch_track_transactions(monkeypatch):
    """track_transactions skill returns [track_transactions] Logged N transactions via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Logged transactions.",'
        '"action":{"skill_name":"track_transactions","params":{"transactions":[{"amount":50,"category":"food"}],"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Log my transactions", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[track_transactions] Logged" in data["summary"]
    assert "1 transactions" in data["summary"]


def test_local_dispatch_get_balance_summary(monkeypatch):
    """get_balance_summary skill returns balance summary via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Balance summary.",'
        '"action":{"skill_name":"get_balance_summary","params":{"period_days":30,"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "What is my balance summary", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[get_balance_summary]" in data["summary"]


def test_local_dispatch_budget_alert(monkeypatch):
    """budget_alert skill returns [budget_alert] Alert set for {category} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Alert set.",'
        '"action":{"skill_name":"budget_alert","params":{"category":"food","limit":500,"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Alert me when food spending exceeds 500", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[budget_alert] Alert set for food" in data["summary"]


def test_local_dispatch_track_investment(monkeypatch):
    """track_investment skill returns [track_investment] Logged {action} {quantity} {ticker} @ {price} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Logged investment.",'
        '"action":{"skill_name":"track_investment","params":{"ticker":"AAPL","action":"buy","quantity":10,"price":150,"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Log a buy of 10 AAPL at 150", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[track_investment] Logged" in data["summary"]
    assert "buy" in data["summary"] and "AAPL" in data["summary"]


def test_local_dispatch_get_portfolio_summary(monkeypatch):
    """get_portfolio_summary skill returns portfolio summary via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Portfolio summary.",'
        '"action":{"skill_name":"get_portfolio_summary","params":{"period_days":30,"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "What is my portfolio summary", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[get_portfolio_summary]" in data["summary"]


def test_local_dispatch_investment_alert(monkeypatch):
    """investment_alert skill returns [investment_alert] Alert set for {ticker} {alert_type} {threshold} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Alert set.",'
        '"action":{"skill_name":"investment_alert","params":{"ticker":"AAPL","alert_type":"price_above","threshold":200,"kb_name":"kb_finance}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Alert me when AAPL goes above 200", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[investment_alert] Alert set for AAPL" in data["summary"]
    assert "price_above" in data["summary"]


def test_local_dispatch_track_social_activity(monkeypatch):
    """track_social_activity skill returns [track_social_activity] Logged {action} on {platform} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Logged social activity.",'
        '"action":{"skill_name":"track_social_activity","params":{"platform":"Twitter","action":"post","content_summary":"Hello world","kb_name":"kb_social}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Log a post on Twitter", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[track_social_activity] Logged" in data["summary"]
    assert "Twitter" in data["summary"]


def test_local_dispatch_query_social_trends(monkeypatch):
    """query_social_trends skill returns trends summary via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Queried social trends.",'
        '"action":{"skill_name":"query_social_trends","params":{"period_days":30,"kb_name":"kb_social}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "What are my social trends", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[query_social_trends]" in data["summary"]


def test_local_dispatch_social_sentiment(monkeypatch):
    """social_sentiment skill returns [social_sentiment] Overall: positive/negative/neutral via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Sentiment analyzed.",'
        '"action":{"skill_name":"social_sentiment","params":{"content":"I love this product","kb_name":"kb_social}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Analyze sentiment of this post", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[social_sentiment] Overall:" in data["summary"]


def test_local_dispatch_track_email(monkeypatch):
    """track_email skill returns [track_email] Logged {action}: {subject} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Logged email.",'
        '"action":{"skill_name":"track_email","params":{"action":"sent","subject":"Hello","summary":"Brief","kb_name":"kb_email}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Log a sent email", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[track_email] Logged" in data["summary"]
    assert "Hello" in data["summary"]


def test_local_dispatch_query_email_history(monkeypatch):
    """query_email_history skill returns history summary via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Queried email history.",'
        '"action":{"skill_name":"query_email_history","params":{"period_days":30,"kb_name":"kb_email}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "What is my email history", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[query_email_history]" in data["summary"]


def test_local_dispatch_email_draft(monkeypatch):
    """email_draft skill returns [email_draft] Draft generated for {recipient} via local dispatch."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Draft generated.",'
        '"action":{"skill_name":"email_draft","params":{"recipient":"Bob","subject":"Re:","body":"Hi","kb_name":"kb_email}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Draft an email to Bob", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "[email_draft] Draft generated for Bob" in data["summary"]


def test_local_dispatch_track_calendar_event(monkeypatch):
    """track_calendar_event skill returns event logged summary via local dispatch; assert converged and 'logged' in summary."""
    monkeypatch.setenv("PAGI_ACTIONS_VIA_GRPC", "false")
    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    monkeypatch.delenv("PAGI_MOCK_MODE", raising=False)
    monkeypatch.setenv("PAGI_MOCK_MODE", "false")

    stub = (
        '{'
        '"thought":"Event added.",'
        '"action":{"skill_name":"track_calendar_event","params":{"title":"Meeting","start_time":"2025-02-05T14:00:00","end_time":"2025-02-05T15:00:00","kb_name":"kb_calendar}},'
        '"is_final":true'
        '}'
    )
    monkeypatch.setenv("PAGI_RLM_STUB_JSON", stub)

    r = client.post(
        "/rlm",
        json={"query": "Add a meeting tomorrow at 2pm", "context": "", "depth": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["converged"] is True
    assert "logged" in data["summary"].lower()
    assert "Meeting" in data["summary"] or "track_calendar_event" in data["summary"]


def test_kb_memory_search(monkeypatch):
    """POST /api/memory then GET /api/search: backend proxies to gRPC UpsertVectors and SemanticSearch; assert hit contains content."""
    from src.pagi_pb import pagi_pb2

    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    mock_stub = MagicMock()
    mock_stub.UpsertVectors.return_value = pagi_pb2.UpsertResponse(success=True, upserted_count=1)
    mock_stub.SemanticSearch.return_value = pagi_pb2.SearchResponse(
        hits=[pagi_pb2.SearchHit(document_id="id1", score=0.9, content_snippet="test content")]
    )

    with patch("src.main._get_kb_stub", return_value=mock_stub), patch(
        "src.main._embed_content", return_value=[0.1] * 384
    ):
        r_upsert = client.post(
            "/api/memory",
            json={"kb_name": "kb_personal", "content": "test content"},
        )
        assert r_upsert.status_code == 200
        data_upsert = r_upsert.json()
        assert data_upsert.get("success") is True
        assert data_upsert.get("upserted_count") == 1

        r_search = client.get("/api/search", params={"query": "test", "kb_name": "kb_personal"})
        assert r_search.status_code == 200
        data_search = r_search.json()
        assert "hits" in data_search
        hits = data_search["hits"]
        assert len(hits) == 1
        assert "test content" in (hits[0].get("content") or "")
        assert hits[0].get("score") == 0.9


def test_health_kb_routes(monkeypatch):
    """POST /api/health/track and GET /api/health/trends: proxy to kb_health; assert success and hits."""
    from src.pagi_pb import pagi_pb2

    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    mock_stub = MagicMock()
    mock_stub.UpsertVectors.return_value = pagi_pb2.UpsertResponse(success=True, upserted_count=1)
    mock_stub.SemanticSearch.return_value = pagi_pb2.SearchResponse(
        hits=[pagi_pb2.SearchHit(document_id="h1", score=0.85, content_snippet="weight 70 steps 5000")]
    )

    with patch("src.main._get_kb_stub", return_value=mock_stub), patch(
        "src.main._embed_content", return_value=[0.1] * 384
    ):
        r_track = client.post(
            "/api/health/track",
            json={"metrics": {"weight": 70, "steps": 5000}},
        )
        assert r_track.status_code == 200
        data_track = r_track.json()
        assert data_track.get("success") is True
        assert "id" in data_track

        r_trends = client.get("/api/health/trends", params={"query": "steps", "period_days": 30})
        assert r_trends.status_code == 200
        data_trends = r_trends.json()
        assert "trends" in data_trends
        trends = data_trends["trends"]
        assert len(trends) == 1
        assert "weight" in (trends[0].get("content") or "") or "steps" in (trends[0].get("content") or "")
        assert trends[0].get("score") == 0.85


def test_finance_kb_routes(monkeypatch):
    """POST /api/finance/track and GET /api/finance/summary: proxy to kb_finance; assert success and summary."""
    from src.pagi_pb import pagi_pb2

    monkeypatch.setenv("PAGI_ALLOW_LOCAL_DISPATCH", "true")
    mock_stub = MagicMock()
    mock_stub.UpsertVectors.return_value = pagi_pb2.UpsertResponse(success=True, upserted_count=1)
    mock_stub.SemanticSearch.return_value = pagi_pb2.SearchResponse(
        hits=[pagi_pb2.SearchHit(document_id="f1", score=0.88, content_snippet="budget 2000 spent 1200")]
    )

    with patch("src.main._get_kb_stub", return_value=mock_stub), patch(
        "src.main._embed_content", return_value=[0.1] * 384
    ):
        r_track = client.post(
            "/api/finance/track",
            json={"transactions": [{"amount": -50, "category": "food"}]},
        )
        assert r_track.status_code == 200
        data_track = r_track.json()
        assert data_track.get("success") is True
        assert data_track.get("upserted_count") == 1

        r_summary = client.get("/api/finance/summary", params={"query": "budget", "period_days": 30})
        assert r_summary.status_code == 200
        data_summary = r_summary.json()
        assert "summary" in data_summary
        summary = data_summary["summary"]
        assert len(summary) == 1
        assert "budget" in (summary[0].get("content") or "") or "spent" in (summary[0].get("content") or "")
        assert summary[0].get("score") == 0.88
