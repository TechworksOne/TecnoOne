# Plan enforcement notes

## reportes_taller

`reportes_taller` exists in the plan module catalog as "Metricas y reportes tecnicos", but there is no dedicated route or screen for workshop reports in the current app.

Current technical metrics live inside the unified Dashboard responses. Those metrics are treated as technical dashboard data and are only queried/exposed when the company has at least one technical module enabled: `reparaciones`, `taller_operativo`, or `reportes_taller`.

No new screen was created. If a dedicated workshop reports page is added later, it should require `reportes_taller` explicitly in both frontend routing and backend routes.
