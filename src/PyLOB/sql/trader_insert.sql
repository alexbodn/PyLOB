insert into trader (
	tid, name, currency,
	commission_min, commission_max_percnt, commission_per_unit,
	allow_self_matching
)
values (
	:tid, :name, :currency, 
	:commission_min, :commission_max_percnt, :commission_per_unit,
	:allow_self_matching
)