# The system of record is mocked behind a two-question adapter

Everything the product needs from the factory's own data reduces to two questions — what is this part, and who can supply it — so the system of record sits behind an adapter with those two capabilities, and the implementation we ship is a mock seeded from YAML using ERPNext's real field names (`item_code`, `actual_qty`, `supplier_name`).

## Considered options

We seriously considered standing up ERPNext itself. Rejected: before you have one believable shortage you need site creation, a chart of accounts, item masters, BOMs, warehouses, stock entries, suppliers and price lists — most of a day of data entry, and none of it visible to anyone looking at the running system, which sees JSON from an endpoint either way. Using ERPNext's field names buys the credibility without the setup, and makes a real `ERPNextAdapter` a single class rather than a refactor.
