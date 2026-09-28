# Local runtime check
Final preview: http://localhost:4100
Home, Product, Workflow, Deployment, Company, Contact, Downloads, Privacy, /health and /api/features returned HTTP 200 after restart. Website stderr was empty.
The actual /api/releases request returned HTTP 503: public mirror release access is not yet available/configured. The Downloads page therefore shows an explicit unavailable/retry state, not fictional version/assets.
This is distinct from passing mocked release pipeline/catalog tests. Actual mirrored customer installers remain NOT VERIFIED until authorized workflow activation and a real successful synchronization.
Core git status remained clean at e97be6a84a6a417a50c22f34571db79d8f90bcc3.
The original reported historical loading incident was not uniquely reproduced against the old runtime. Audit found a concrete unbounded-fetch path and demonstrated its repair with stalled-request tests.
