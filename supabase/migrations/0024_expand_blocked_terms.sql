-- contains_blocked_term() (0023) matches whole words only, deliberately -
-- dropping the trailing word-boundary requirement to catch inflected forms
-- via prefix matching would reintroduce the exact "Scunthorpe problem" this
-- was built to avoid (e.g. "cock" as a prefix would flag "cockpit"/
-- "cocktail"/"cockatoo"). Instead, common inflected forms just get their own
-- explicit entries.
insert into blocked_terms (term) values
  ('shitty'), ('shitting'), ('fucking'), ('fucked'), ('fucker'),
  ('bitchy'), ('bitches'), ('dickhead')
on conflict (term) do nothing;
