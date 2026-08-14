#!/usr/bin/fish
# Copies the built jars into matching Prism instances for in-game testing.
#
# Every supported port is a normal mod jar now — the coremod, javaagent and
# compatibility-alias handling all went away with the legacy ports.
for t in ears-(ls -1d platform-* |cut -d- -f2-)
	set dir ~/PrismInstances/$t/minecraft/mods
	mkdir -p $dir
	rm -f $dir/ears-*.jar
	cp artifacts/$t-*.jar $dir
end
