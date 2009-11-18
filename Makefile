###########################################################################
# Makefile for automating various webOS SDK development tasks
# l.m.orchard@pobox.com 
# http://decafbad.com
#
# Example targets:
#     make jslint
#     make jsdoc
# 	  make update
# 	  make tests
# 	  TARGET=device make update
# 	  TARGET=device make tests
#
# TODO: Get Palm Inspector kill / launch working on Linux?
#
###########################################################################

APPID=$(shell grep '"id"' src/appinfo.json | cut -d: -f2 | cut -d'"' -f2)
VERSION=$(shell grep '"version"' src/appinfo.json | cut -d: -f2 | cut -d'"' -f2)
OS=$(shell uname -s)
IPK=bin/$(APPID)_$(VERSION)_all.ipk

ifeq ($(TARGET),device)
	NOVACOM_ID=$(shell novacom -l | grep castle-linux | head -1 | cut -d' ' -f2)
	DEVICE=usb
	UPDATE_TARGETS=remove launch tail-log
	TESTS_TARGETS=launch-tests tail-log
else
	NOVACOM_ID=$(shell novacom -l | grep emulator | head -1 | cut -d' ' -f2)
	DEVICE=tcp
	#UPDATE_TARGETS=kill-inspector remove restart launch launch-inspector tail-log
	UPDATE_TARGETS=install launch tail-log
	TESTS_TARGETS=launch-tests tail-log
endif

all: update

docs: FORCE
	jsdoc -c=docs/jsdoc-toolkit.conf

lint: FORCE
	for fn in `find src -type f -not -path '*/vendor/*' -name '*js'`; do \
		echo '----------------------------------------'; \
		echo $$fn; \
		cat $$fn | jslint; \
	done;

FORCE:

package:
	palm-package -o bin src

tests: $(TESTS_TARGETS)

update: $(UPDATE_TARGETS)

#tail-log:
#	-palm-log -f -d $(DEVICE) $(APPID)

tail-log:
	echo '----------------------------------------'; echo; \
	echo 'tail -f /var/log/messages | grep $(APPID)' | novacom -d $(NOVACOM_ID) open tty://

kill:
	-palm-launch -d $(DEVICE) -c $(APPID)

remove: kill
	-palm-install -d $(DEVICE) -r $(APPID)

restart:
	echo 'killall LunaSysMgr; exit' | novacom -d $(NOVACOM_ID) open tty://; 
	sleep 3;

reboot:
	echo 'reboot; exit' | novacom -d $(NOVACOM_ID) open tty://

install: package
	palm-install -d $(DEVICE) $(IPK)

launch: install
	palm-launch -d $(DEVICE) -i $(APPID)

launch-tests: install
	#palm-launch -p "{ mojoTest:true }" -d $(DEVICE) $(APPID)
	palm-launch -p "{ testsEnabled:true, runTestsAtLaunch:true }" -d $(DEVICE) $(APPID)

kill-inspector:
ifeq ($(OS),Darwin)
	-ps x | grep -i 'palm inspector' | grep -v 'grep' | cut -c1-6 | xargs kill
endif

launch-inspector:
ifeq ($(OS),Darwin)
	sleep 3; 
	open -g -a Palm\ Inspector;
endif
