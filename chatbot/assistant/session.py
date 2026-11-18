# assistant/session.py


class Session:

    def __init__(
        self,
        user_id,
        name,
        role
    ):

        self.user_id = user_id

        self.name = name

        self.role = role

        # ----------------------------------------------------
        # Conversation history
        # ----------------------------------------------------

        self.messages = []

        # ----------------------------------------------------
        # Current employee selected/referenced
        # ----------------------------------------------------

        self.current_employee = None

        # ----------------------------------------------------
        # Pending clarification
        # ----------------------------------------------------

        self.pending_candidates = []

        self.pending_question = None

    # ========================================================
    # CURRENT EMPLOYEE
    # ========================================================

    def set_current_employee(
        self,
        employee
    ):

        self.current_employee = employee

    # ========================================================
    # CLEAR CURRENT EMPLOYEE
    # ========================================================

    def clear_current_employee(self):

        self.current_employee = None

    # ========================================================
    # PENDING CLARIFICATION
    # ========================================================

    def set_pending_candidates(
        self,
        candidates,
        question
    ):

        self.pending_candidates = candidates

        self.pending_question = question

    def clear_pending(self):

        self.pending_candidates = []

        self.pending_question = None