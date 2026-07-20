-- Widen bathroom_reviews.overall_rating from numeric(3,1) to numeric(4,2) so
-- a rating can be stored to hundredths (e.g. 9.25), not just tenths. Existing
-- values (currently tenths only) round-trip losslessly under the wider scale.
-- The bound itself was already correct (0.0-10.0) - this just makes the
-- 0.00-10.00 precision explicit and matches the new scale.
alter table bathroom_reviews
  alter column overall_rating type numeric(4, 2);

alter table bathroom_reviews
  drop constraint if exists bathroom_reviews_overall_rating_check;

alter table bathroom_reviews
  add constraint bathroom_reviews_overall_rating_check
  check (overall_rating >= 0.00 and overall_rating <= 10.00);
