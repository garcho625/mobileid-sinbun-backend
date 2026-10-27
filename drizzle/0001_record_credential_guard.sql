-- A receipt ID permanently belongs to its original credential. Also protects
-- concurrent sync requests whose pre-write validation saw no existing receipt.
CREATE TRIGGER records_credential_immutable
BEFORE UPDATE OF credential ON records
WHEN OLD.credential <> NEW.credential
BEGIN
  SELECT RAISE(ABORT, 'record_credential_conflict');
END;
