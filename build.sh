#!/bin/bash -e
#
# Builds Ears Common and every supported platform, collecting the finished jars into artifacts/.
#
# Supported matrix: Fabric and NeoForge on 1.21.11 and 26.1. The 26.1 artifacts also declare
# 26.1.x and 26.2; see publish-curseforge/build.gradle and publish-modrinth/build.gradle.
#
# Unlike the old multi-JDK version of this script, you only need one JDK that Gradle 9.2 can run
# on (17 through 25). The 26.1 ports request a Java 25 toolchain, which Gradle downloads itself
# via the foojay resolver, so JAVA*_HOME juggling is no longer needed.
#
# This script needs bash. On Windows, invoke the per-module wrapper instead:
#   cd platform-fabric-1.21.11 && ./gradlew build

platforms="fabric-1.21.11 fabric-26.1 neoforge-1.21.11 neoforge-26.1"

toBuild="$platforms"
if [ -n "$1" ]; then
	toBuild="$@"
fi

# chronic (moreutils) hides output unless a command fails; plain passthrough if it isn't installed
quiet() {
	if command -v chronic >/dev/null; then
		chronic "$@"
	else
		"$@"
	fi
}

mkdir -p artifacts
for proj in $toBuild; do
	rm -f artifacts/ears-$proj*
done

echo 'Building common...'
(
	cd common
	TERM=dumb quiet ./gradlew clean build --stacktrace
)

count=$(echo $toBuild | wc -w)
s=s
if [ "$count" -eq 1 ]; then
	s=
fi
echo "Building $count platform$s..."
for proj in $toBuild; do
	(
		cd platform-$proj
		rm -f build-ok
		TERM=dumb quiet ./gradlew clean build --stacktrace && touch build-ok && echo "Built $proj successfully"
		rm -f build/libs/*-dev.jar
	) &
done
wait

exit=
for proj in $toBuild; do
	if [ ! -e "platform-$proj/build-ok" ]; then
		echo "Build failure in platform $proj."
		exit=y
	fi
	rm -f "platform-$proj/build-ok"
done
if [ "$exit" == "y" ]; then
	echo "Exiting due to build failures."
	exit 1
fi
echo 'All builds completed successfully.'
for proj in $toBuild; do
	cp platform-$proj/build/libs/* artifacts
done
rm -f artifacts/*-dev.jar artifacts/*-sources.jar
