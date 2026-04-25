-- ============================================================
-- ASK BOTANIQUE — SCHEMA MIGRATION v7 (MARKETPLACE RLS POLICIES)
-- Purpose: attach row-level security policies to every marketplace
--          table created in migration_v4. Until this runs, anon and
--          authenticated clients can read NOTHING from these tables.
-- Idempotent: drops policies before recreating.
-- ============================================================

-- ============================================================
-- 1) NURSERIES
-- ============================================================
DROP POLICY IF EXISTS nurseries_public_read     ON nurseries;
DROP POLICY IF EXISTS nurseries_owner_insert    ON nurseries;
DROP POLICY IF EXISTS nurseries_owner_update    ON nurseries;
DROP POLICY IF EXISTS nurseries_owner_delete    ON nurseries;

-- Anyone (anon + authed) can read active nurseries
CREATE POLICY nurseries_public_read ON nurseries
  FOR SELECT
  USING (is_active = true);

-- Authed users can claim a nursery (must set themselves as owner)
CREATE POLICY nurseries_owner_insert ON nurseries
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Owner can update their own nursery (cannot self-verify; admin sets is_verified)
CREATE POLICY nurseries_owner_update ON nurseries
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Owner can delete (soft-delete via is_active is preferred, but allow hard-delete)
CREATE POLICY nurseries_owner_delete ON nurseries
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- ============================================================
-- 2) NURSERY_INVENTORY
-- ============================================================
DROP POLICY IF EXISTS inventory_public_read   ON nursery_inventory;
DROP POLICY IF EXISTS inventory_owner_insert  ON nursery_inventory;
DROP POLICY IF EXISTS inventory_owner_update  ON nursery_inventory;
DROP POLICY IF EXISTS inventory_owner_delete  ON nursery_inventory;

-- Anyone can read inventory rows that belong to an active nursery
CREATE POLICY inventory_public_read ON nursery_inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = nursery_inventory.nursery_id
        AND n.is_active = true
    )
  );

-- Nursery owner can add inventory to their own nursery
CREATE POLICY inventory_owner_insert ON nursery_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = nursery_inventory.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  );

CREATE POLICY inventory_owner_update ON nursery_inventory
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = nursery_inventory.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = nursery_inventory.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  );

CREATE POLICY inventory_owner_delete ON nursery_inventory
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = nursery_inventory.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3) PROFESSIONALS
-- ============================================================
DROP POLICY IF EXISTS professionals_public_read     ON professionals;
DROP POLICY IF EXISTS professionals_owner_insert    ON professionals;
DROP POLICY IF EXISTS professionals_owner_update    ON professionals;
DROP POLICY IF EXISTS professionals_owner_delete    ON professionals;

CREATE POLICY professionals_public_read ON professionals
  FOR SELECT
  USING (is_active = true);

CREATE POLICY professionals_owner_insert ON professionals
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY professionals_owner_update ON professionals
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY professionals_owner_delete ON professionals
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 4) PROJECT_BRIEFS
-- ============================================================
DROP POLICY IF EXISTS briefs_owner_or_public_read ON project_briefs;
DROP POLICY IF EXISTS briefs_owner_insert         ON project_briefs;
DROP POLICY IF EXISTS briefs_owner_update         ON project_briefs;
DROP POLICY IF EXISTS briefs_owner_delete         ON project_briefs;

-- Owner sees all their briefs; everyone sees public briefs
CREATE POLICY briefs_owner_or_public_read ON project_briefs
  FOR SELECT
  USING (is_public = true OR client_user_id = auth.uid());

CREATE POLICY briefs_owner_insert ON project_briefs
  FOR INSERT
  TO authenticated
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY briefs_owner_update ON project_briefs
  FOR UPDATE
  TO authenticated
  USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

CREATE POLICY briefs_owner_delete ON project_briefs
  FOR DELETE
  TO authenticated
  USING (client_user_id = auth.uid());

-- ============================================================
-- 5) PROJECT_APPLICATIONS
-- ============================================================
DROP POLICY IF EXISTS applications_visible_to_parties ON project_applications;
DROP POLICY IF EXISTS applications_pro_insert         ON project_applications;
DROP POLICY IF EXISTS applications_pro_update         ON project_applications;
DROP POLICY IF EXISTS applications_brief_owner_update ON project_applications;

-- Visible to: the brief owner OR the applying professional
CREATE POLICY applications_visible_to_parties ON project_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_briefs b
      WHERE b.id = project_applications.brief_id
        AND b.client_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = project_applications.professional_id
        AND p.user_id = auth.uid()
    )
  );

-- Professional applies as themselves
CREATE POLICY applications_pro_insert ON project_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = project_applications.professional_id
        AND p.user_id = auth.uid()
    )
  );

-- Pro can edit their own application (e.g. cover note, proposed budget)
CREATE POLICY applications_pro_update ON project_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = project_applications.professional_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = project_applications.professional_id
        AND p.user_id = auth.uid()
    )
  );

-- Brief owner can shortlist / accept / decline
CREATE POLICY applications_brief_owner_update ON project_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_briefs b
      WHERE b.id = project_applications.brief_id
        AND b.client_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_briefs b
      WHERE b.id = project_applications.brief_id
        AND b.client_user_id = auth.uid()
    )
  );

-- ============================================================
-- 6) RFQ_REQUESTS
-- ============================================================
DROP POLICY IF EXISTS rfq_requester_read    ON rfq_requests;
DROP POLICY IF EXISTS rfq_requester_insert  ON rfq_requests;
DROP POLICY IF EXISTS rfq_requester_update  ON rfq_requests;
DROP POLICY IF EXISTS rfq_requester_delete  ON rfq_requests;
DROP POLICY IF EXISTS rfq_invited_nursery_read ON rfq_requests;

-- Requester sees their own RFQs
CREATE POLICY rfq_requester_read ON rfq_requests
  FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid());

-- Nurseries that have been invited (have a row in rfq_responses) can see the RFQ
CREATE POLICY rfq_invited_nursery_read ON rfq_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rfq_responses r
      JOIN nurseries n ON n.id = r.nursery_id
      WHERE r.rfq_id = rfq_requests.id
        AND n.owner_user_id = auth.uid()
    )
  );

CREATE POLICY rfq_requester_insert ON rfq_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY rfq_requester_update ON rfq_requests
  FOR UPDATE
  TO authenticated
  USING (requester_user_id = auth.uid())
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY rfq_requester_delete ON rfq_requests
  FOR DELETE
  TO authenticated
  USING (requester_user_id = auth.uid());

-- ============================================================
-- 7) RFQ_ITEMS  (line items of an RFQ — same scope as parent)
-- ============================================================
DROP POLICY IF EXISTS rfq_items_party_read   ON rfq_items;
DROP POLICY IF EXISTS rfq_items_owner_write  ON rfq_items;

CREATE POLICY rfq_items_party_read ON rfq_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_requests rq
      WHERE rq.id = rfq_items.rfq_id
        AND (
          rq.requester_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM rfq_responses r
            JOIN nurseries n ON n.id = r.nursery_id
            WHERE r.rfq_id = rq.id
              AND n.owner_user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY rfq_items_owner_write ON rfq_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_requests rq
      WHERE rq.id = rfq_items.rfq_id
        AND rq.requester_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_requests rq
      WHERE rq.id = rfq_items.rfq_id
        AND rq.requester_user_id = auth.uid()
    )
  );

-- ============================================================
-- 8) RFQ_RESPONSES (one per nursery per RFQ)
-- ============================================================
DROP POLICY IF EXISTS rfq_resp_party_read    ON rfq_responses;
DROP POLICY IF EXISTS rfq_resp_nursery_write ON rfq_responses;

-- RFQ requester + responding nursery owner can both see
CREATE POLICY rfq_resp_party_read ON rfq_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_requests rq
      WHERE rq.id = rfq_responses.rfq_id
        AND rq.requester_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = rfq_responses.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  );

-- Nursery owner can insert/update their response row
CREATE POLICY rfq_resp_nursery_write ON rfq_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = rfq_responses.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nurseries n
      WHERE n.id = rfq_responses.nursery_id
        AND n.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 9) RFQ_RESPONSE_ITEMS
-- ============================================================
DROP POLICY IF EXISTS rfq_resp_items_party_read   ON rfq_response_items;
DROP POLICY IF EXISTS rfq_resp_items_nursery_write ON rfq_response_items;

CREATE POLICY rfq_resp_items_party_read ON rfq_response_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_responses r
      JOIN rfq_requests rq ON rq.id = r.rfq_id
      WHERE r.id = rfq_response_items.rfq_response_id
        AND (
          rq.requester_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM nurseries n
            WHERE n.id = r.nursery_id
              AND n.owner_user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY rfq_resp_items_nursery_write ON rfq_response_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfq_responses r
      JOIN nurseries n ON n.id = r.nursery_id
      WHERE r.id = rfq_response_items.rfq_response_id
        AND n.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rfq_responses r
      JOIN nurseries n ON n.id = r.nursery_id
      WHERE r.id = rfq_response_items.rfq_response_id
        AND n.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 10) REVIEWS
-- ============================================================
DROP POLICY IF EXISTS reviews_public_read     ON reviews;
DROP POLICY IF EXISTS reviews_reviewer_insert ON reviews;
DROP POLICY IF EXISTS reviews_reviewer_update ON reviews;
DROP POLICY IF EXISTS reviews_reviewer_delete ON reviews;

CREATE POLICY reviews_public_read ON reviews
  FOR SELECT
  USING (true);

CREATE POLICY reviews_reviewer_insert ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY reviews_reviewer_update ON reviews
  FOR UPDATE
  TO authenticated
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY reviews_reviewer_delete ON reviews
  FOR DELETE
  TO authenticated
  USING (reviewer_user_id = auth.uid());

-- ============================================================
-- updated_at trigger for nurseries (so dashboard shows fresh state)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nurseries_updated_at         ON nurseries;
DROP TRIGGER IF EXISTS trg_professionals_updated_at     ON professionals;
DROP TRIGGER IF EXISTS trg_project_briefs_updated_at    ON project_briefs;
DROP TRIGGER IF EXISTS trg_rfq_requests_updated_at      ON rfq_requests;

CREATE TRIGGER trg_nurseries_updated_at      BEFORE UPDATE ON nurseries      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_professionals_updated_at  BEFORE UPDATE ON professionals  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_project_briefs_updated_at BEFORE UPDATE ON project_briefs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rfq_requests_updated_at   BEFORE UPDATE ON rfq_requests   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- End migration v7
-- ============================================================
