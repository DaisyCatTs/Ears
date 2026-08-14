#!/bin/bash -e
#
# Publishes the jars in artifacts/ to CurseForge, Modrinth and mcmod.cn.
# Pass - for any token to skip that destination.
#
# Supported matrix: Fabric and NeoForge on 1.21.11 and 26.1. The 26.1 artifacts also declare
# 26.1.x and 26.2 as compatible game versions.
if [ -z "$1" -o -z "$2" -o -z "$3" ]; then
	echo "Need a Curse API key, Modrinth API key, and mcmod.cn cookie to publish."
	exit 2
fi
if [ ! -s "changelog.html" ]; then
	echo "Changelog is empty; refusing to publish."
	exit 1
fi

CURSE_TOKEN=$1
shift
MODRINTH_TOKEN=$1
shift
MCMODCN_COOKIE=$1
shift

if [ -n "$1" ]; then
	common="$@"
else
	common="
		fabric-1.21.11 fabric-26.1
		neoforge-1.21.11 neoforge-26.1"
fi
curse="$common"
modrinth="$common"
mcmodcn="$common"

cd publish-curseforge
if [ "$CURSE_TOKEN" != "-" ]; then
	for proj in $curse; do
		echo Publishing $proj to CurseForge...
		TERM=dumb chronic ./gradlew -PcurseApiKey=$CURSE_TOKEN -Ptarget=$proj curseforge
	done
fi
cd ../publish-modrinth
if [ "$MODRINTH_TOKEN" != "-" ]; then
	for proj in $modrinth; do
		echo Publishing $proj to Modrinth...
		TERM=dumb chronic ./gradlew -PmodrinthApiKey=$MODRINTH_TOKEN -Ptarget=$proj modrinth
	done
fi
cd ..
if [ "$MCMODCN_COOKIE" != "-" ]; then
	export MCMODCN_COOKIE
	classID=3996
	fabric=2
	quilt=11
	neoforge=13
	for proj in $mcmodcn; do
		title=""
		loaders=""
		case $proj in
			fabric-1.21.11)
				title="1.21.11"
				loaders="$fabric,$quilt"
			;;
			fabric-26.1)
				title="26.1"
				loaders="$fabric,$quilt"
			;;
			neoforge-1.21.11)
				title="1.21.11"
				loaders="$neoforge"
			;;
			neoforge-26.1)
				title="26.1"
				loaders="$neoforge"
			;;
			*)
				echo "Unknown project $proj for mcmod.cn publish"
				exit 2
			;;
		esac
		./mcmodcn-upload.sh $classID "$title" "$loaders" 'client' artifacts/ears-$proj-*.jar
	done
	export -n MCMODCN_COOKIE
fi
