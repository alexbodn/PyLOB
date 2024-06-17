
insert into requests (subject, reqId, extra)
select
	:subject as subject,
	coalesce(:reqId, (
		select coalesce(max(reqId), 0) + 1
		from requests
		where subject=:subject
	)) as reqId,
	:extra as extra
;
