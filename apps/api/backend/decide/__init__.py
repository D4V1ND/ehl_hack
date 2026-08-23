"""Assemble the decision and the artifacts a human reviews.

`run` is the only place that reads the system of record, the claims and the
policy and cost modules together. Everything it calls is pure; everything it
writes lands in `cases/<case_id>/`, which is the datastore and the review
package at the same time.
"""
