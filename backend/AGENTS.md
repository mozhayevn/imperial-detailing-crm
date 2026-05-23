Project: CRM for car detailing

General rules:
- Do not break existing architecture
- Do not oversimplify business logic
- Keep code production-ready
- Prefer clean and maintainable solutions

Backend rules:
- Respect RBAC (roles and permissions)
- Do not bypass permission checks
- Keep role hierarchy intact
- Super admin has full access

Orders:
- Do not recreate order items unnecessarily
- Keep order_item_id stable on update
- Preserve item-level logic

Pricing:
- Respect pricing lock/unlock flow
- Do not allow changes when pricing is locked
- Maintain pricing snapshots
- Do not break pricing calculations
- Preserve discount logic and validation

Materials:
- Do not duplicate materials for the same order_item
- Merge quantities when same material is added

Audit:
- Do not remove audit logic
- Keep detailed audit for orders and pricing
- Preserve structure of audit logs

Clients:
- Preserve preferences and history logic
- Do not break client history endpoint

Work bays:
- Respect scheduling logic
- Prevent time conflicts

Future architecture:
- System should support chatbot integrations
- System should support AI features
- Do not introduce changes that block future scaling

Behavior:
- Before making large changes, explain reasoning
- Prefer small safe changes
- Highlight risks before modifying core logic
