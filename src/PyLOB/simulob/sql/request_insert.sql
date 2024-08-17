
insert into requests (subject, reqId, extra)
values (:subject, :reqId, :extra)
on conflict (subject, reqId)
do update
    set extra=:extra
where subject=:subject and reqId=:reqId
;
