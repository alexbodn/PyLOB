
select max(reqId) as lastrequest
from requests
where subject=:subject
;
