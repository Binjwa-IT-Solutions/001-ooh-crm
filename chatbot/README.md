# Media Octus CRM AI Assistant

An intelligent, multi-turn conversational interface for querying and updating employee records, attendance, and leave balances in the Media Octus CRM.

## Project Structure

The project has been structured for production readiness, cleanly separating conversational logic from data access.

- `main.py`: The entry point. Handles the interactive CLI, rate limiting, and session lifecycle.
- `assistant/`: Contains the core conversational engine.
  - `assistant.py`: Manages the system prompt, tool routing, and multi-provider LLM failover.
  - `permissions.py`: The Role-Based Access Control (RBAC) engine. Ensures tools are only visible to authorized users.
  - `session.py`: Maintains conversation history and contextual state (e.g. pronoun resolution).
- `tools/`: LangChain `@tool` definitions. These are purely interfaces for the LLM. They parse arguments and immediately delegate to the adapter.
- `adapters/`: The data translation layer.
  - `crm_adapter.py`: Acts as the bridge between the AI tools and the underlying database. All reads/writes happen here.
- `data/`: Contains `db.json` and `dummy_data.py`. This will eventually be replaced by the real CRM database.
- `config/`: Contains `settings.py` for environment variables, fallback chains, and timeouts.
- `utils/`: Contains `logger.py` (for auditing) and `rate_limiter.py` (for abuse prevention).

## How to Add a New Tool

To add a new capability to the assistant, follow this 3-step process:

1. **Write the Adapter Function**
   Add your business logic to `adapters/crm_adapter.py`. This function should perform the actual data fetch or mutation and return a Python dictionary. Do not put LangChain logic here.

2. **Define the Tool Interface**
   Create a new `@tool` in the `tools/` directory. Write a crystal-clear docstring (this is what the LLM reads to understand when and how to use it). Have the tool simply call your adapter function and return the result.
   ```python
   @tool
   def get_new_data(param: str):
       \"\"\"Description of when the LLM should use this tool...\"\"\"
       return crm_adapter.get_new_data(param)
   ```

3. **Register the Tool and Set Permissions**
   - Import your tool into `assistant/assistant.py` and add it to the `ALL_TOOLS` dictionary.
   - Update `assistant/permissions.py` (`get_allowed_tools`) to specify which roles (admin, manager, agent) are permitted to see and use this tool.

## How the Permission System Works

Permissions are strictly enforced at the application layer, **not** by the LLM. 
When a user asks a question:
1. `permissions.py` determines which tools the user's role is allowed to see.
2. The LLM is *only* given the definitions for those allowed tools.
3. If the LLM attempts to call a tool anyway (e.g. via hallucination), the execution engine intercepts the call and blocks it, returning a `permission_denied` status.
4. For data-level filtering (e.g. managers can only see their own direct reports), `filter_accessible_employees` strips unauthorized data out of the tool's result *before* the LLM ever sees it.

## Running the Test Suite

The test suite verifies RBAC enforcement, contextual pronoun resolution, and ambiguous name handling. 
To run the automated regression tests:

```bash
# Ensure your virtual environment is active
python tests/test_assistant.py
```