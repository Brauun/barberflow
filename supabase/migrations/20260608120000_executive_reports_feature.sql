with feature_seed(slug, feature_key, feature_value) as (
  values
    ('starter', 'HAS_EXECUTIVE_REPORTS', 'false'::jsonb),
    ('professional', 'HAS_EXECUTIVE_REPORTS', 'true'::jsonb),
    ('premium', 'HAS_EXECUTIVE_REPORTS', 'true'::jsonb)
)
insert into public.subscription_features (plan_id, feature_key, feature_value)
select p.id, fs.feature_key, fs.feature_value
from feature_seed fs
join public.plans p on lower(p.slug) = fs.slug
on conflict (plan_id, feature_key) do update set
  feature_value = excluded.feature_value;
