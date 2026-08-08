## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

### Setup on a new machine

`graphify` is a machine-global pip install, not part of this repo — `graphify-out/` is also not committed (see `.gitignore`). On a fresh machine:

```
pip install --user graphifyy
graphify install                      # registers the Claude Code skill globally
export PATH="$PATH:<python-user-scripts-dir>"   # Windows: %APPDATA%\Python\Python3XX\Scripts — add permanently via User PATH, not just this shell
cd <this repo>
graphify . --code-only                # AST-only, no LLM key needed — rebuilds graphify-out/
graphify cluster-only .               # generates GRAPH_REPORT.md + names communities
```

Optional (only if you want LLM-labeled community names or doc/PDF semantic extraction): set `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/etc. and drop `--code-only`.

`caveman` (terse-output Claude Code plugin, unrelated to graphify) is also a machine-global install and needs reinstalling separately per machine if wanted:
```
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash -s -- --only claude --non-interactive
```
It's a personal preference (verbosity), not required for this project.
