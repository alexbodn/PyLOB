
select max(reqId) as reqId
from requests
where subject=:subject
;
