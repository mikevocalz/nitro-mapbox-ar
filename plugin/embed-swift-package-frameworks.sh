# Copies the dynamic frameworks that Swift packages build into the app bundle.
#
# React Native's spm_dependency attaches the Mapbox packages to the static
# NitroMapboxAR pod. MapboxCommon and MapboxCoreMaps are dynamic binary
# xcframeworks and Turf builds as a dynamic framework, so the app links them
# through @rpath, but no Embed Frameworks phase on a static pod target can copy
# them. Without this phase the app dies in dyld at launch with
# "Library not loaded: @rpath/MapboxCommon.framework/MapboxCommon".
#
# Nothing here names a Mapbox framework. The phase walks the @rpath framework
# references of the linked app binaries (and of every framework it copies),
# takes the ones Xcode built from Swift packages (BUILT_PRODUCTS_DIR or its
# PackageFrameworks folder) whose Mach-O is a dynamic library, copies them into
# the bundle's Frameworks folder and signs them the way CocoaPods signs its
# embedded frameworks. Static archives and CocoaPods frameworks are left alone.
set -euo pipefail

case "${PLATFORM_NAME:-}" in
  xros | xrsimulator)
    # Mapbox Maps has no visionOS build; nothing is linked there.
    exit 0
    ;;
esac

if [ "${ENABLE_USER_SCRIPT_SANDBOXING:-NO}" = "YES" ]; then
  echo "warning: [nitro-mapbox-ar] ENABLE_USER_SCRIPT_SANDBOXING is YES on ${TARGET_NAME}; the sandbox can deny reads of the Swift package frameworks in ${BUILT_PRODUCTS_DIR}. Set it to NO on the app target if this phase fails."
fi

stamp="${SCRIPT_OUTPUT_FILE_0}"
depfile="${DERIVED_FILE_DIR}/nitro-mapbox-ar-embed-frameworks.d"
dest="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"

queue=()
exe="${TARGET_BUILD_DIR}/${EXECUTABLE_PATH}"
if [ -f "$exe" ]; then queue+=("$exe"); fi
# Debug builds with ENABLE_DEBUG_DYLIB put the app code, and its links, here.
debug_dylib="${TARGET_BUILD_DIR}/${EXECUTABLE_FOLDER_PATH}/${EXECUTABLE_NAME}.debug.dylib"
if [ -f "$debug_dylib" ]; then queue+=("$debug_dylib"); fi

inputs=()
if [ ${#queue[@]} -gt 0 ]; then inputs+=("${queue[@]}"); fi
seen=" "
copied=0
i=0
while [ "$i" -lt "${#queue[@]}" ]; do
  binary="${queue[$i]}"
  i=$((i + 1))
  for name in $(otool -L "$binary" | sed -n 's#^[[:space:]]*@rpath/\([^/]*\)\.framework/.*#\1#p'); do
    case "$seen" in *" $name "*) continue ;; esac
    seen="${seen}${name} "

    src=""
    for dir in "${BUILT_PRODUCTS_DIR}" "${BUILT_PRODUCTS_DIR}/PackageFrameworks"; do
      if [ -f "$dir/$name.framework/$name" ]; then
        src="$dir/$name.framework"
        break
      fi
    done
    if [ -z "$src" ]; then continue; fi
    if ! file -bL "$src/$name" | grep -q "dynamically linked shared library"; then continue; fi

    mkdir -p "$dest"
    rsync -a --delete --exclude Headers --exclude PrivateHeaders --exclude Modules "$src/" "$dest/$name.framework/"
    if [ -n "${EXPANDED_CODE_SIGN_IDENTITY:-}" ] && [ "${CODE_SIGNING_REQUIRED:-}" != "NO" ] && [ "${CODE_SIGNING_ALLOWED:-}" != "NO" ]; then
      # OTHER_CODE_SIGN_FLAGS is a list of flags; split it like CocoaPods does.
      # shellcheck disable=SC2086
      codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" ${OTHER_CODE_SIGN_FLAGS:-} --preserve-metadata=identifier,entitlements "$dest/$name.framework"
    fi
    echo "[nitro-mapbox-ar] embedded $name.framework from $src"
    copied=$((copied + 1))
    inputs+=("$src/$name")
    queue+=("$dest/$name.framework/$name")
  done
done

# Discovered dependencies: the phase reruns when the app binaries relink or a
# package framework changes, and is skipped otherwise.
mkdir -p "$(dirname "$depfile")"
{
  printf '%s:' "${stamp// /\\ }"
  if [ ${#inputs[@]} -gt 0 ]; then
    for input in "${inputs[@]}"; do printf ' %s' "${input// /\\ }"; done
  fi
  printf '\n'
} > "$depfile"
echo "[nitro-mapbox-ar] $copied Swift package framework(s) embedded in ${dest}"
touch "$stamp"
