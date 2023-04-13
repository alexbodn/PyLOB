insert into instrument (symbol, :field)
	values (:instrument, :value)
on conflict(symbol) do 
update set :field=:value;
