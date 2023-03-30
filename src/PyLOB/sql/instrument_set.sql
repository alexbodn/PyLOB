insert into instrument (symbol, :field)
values (:instrument, :value)
on conflict do nothing;
update instrument 
set :field=:value 
where symbol=:instrument;
