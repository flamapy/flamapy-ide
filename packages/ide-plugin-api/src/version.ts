/**
 * The version of this contract. Follows semver: a minor release only adds API, a major
 * release may break plugins. Plugins declare the range they were built against in
 * `manifest.engines.pluginApi` (e.g. `'^1.0.0'`) and the host refuses to activate a
 * plugin whose range this version does not satisfy.
 */
export const PLUGIN_API_VERSION = '1.0.0';

/**
 * Modules the IDE shares with remotely loaded plugins through its import map: a remote
 * bundle must import these as bare specifiers (build them as externals) and must not
 * bundle its own copy. The values are the versions the IDE guarantees to provide.
 */
export const SHARED_MODULES = {
  react: '^18.3.0',
  'react-dom': '^18.3.0',
  'react/jsx-runtime': '^18.3.0',
  '@flamapy/ide-plugin-api': `^${PLUGIN_API_VERSION}`,
} as const;

type Version = [number, number, number, string];
type Comparator = (version: Version) => boolean;

function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    text.trim(),
  );
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? ''];
}

function compare(a: Version, b: Version): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] as number) - (b[index] as number);
    if (difference !== 0) {
      return difference;
    }
  }
  // A pre-release sorts before its release: 1.0.0-beta < 1.0.0.
  if (a[3] === b[3]) {
    return 0;
  }
  if (a[3] === '') {
    return 1;
  }
  if (b[3] === '') {
    return -1;
  }
  return a[3] < b[3] ? -1 : 1;
}

/** One comparator such as `^1.2.0`, `~1.2`, `>=1.0.0`, `1.x` or `*`. */
function parseComparator(text: string): Comparator | null {
  const match = /^(\^|~|>=|<=|>|<|=)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(-[0-9A-Za-z.-]+)?$/.exec(
    text,
  );
  if (!match) {
    return text === '*' || text === '' ? () => true : null;
  }
  const operator = match[1] ?? '';
  const parts = [match[2], match[3], match[4]];
  const wildcard = parts.findIndex((part) => part === undefined || /^[xX*]$/.test(part));
  const given = wildcard === -1 ? 3 : wildcard;
  const numbers = parts.map((part, index) => (index < given ? Number(part) : 0));
  const base: Version = [numbers[0]!, numbers[1]!, numbers[2]!, match[5]?.slice(1) ?? ''];
  const atLeast: Comparator = (version) => compare(version, base) >= 0;
  const below = (upper: Version): Comparator => (version) => compare(version, upper) < 0;
  const bump = (index: number): Version => {
    const upper: Version = [base[0], base[1], base[2], ''];
    upper[index] = (upper[index] as number) + 1;
    for (let rest = index + 1; rest < 3; rest += 1) {
      upper[rest] = 0;
    }
    return upper;
  };

  if (given === 0) {
    // `x`, `*`, `>=x`: any version.
    return operator === '<' || operator === '>' ? null : () => true;
  }
  switch (operator) {
    case '^': {
      // ^1.2.3 <2.0.0, ^0.2.3 <0.3.0, ^0.0.3 <0.0.4
      const index = base[0] > 0 || given < 2 ? 0 : base[1] > 0 || given < 3 ? 1 : 2;
      return (version) => atLeast(version) && below(bump(index))(version);
    }
    case '~':
      return (version) => atLeast(version) && below(bump(given === 3 ? 1 : given - 1))(version);
    case '>=':
      return atLeast;
    case '>':
      // `>1.2` means "after the whole 1.2 minor", i.e. >=1.3.0.
      return given === 3
        ? (version) => compare(version, base) > 0
        : (version) => compare(version, bump(given - 1)) >= 0;
    case '<':
      return below(base);
    case '<=':
      return given === 3 ? (version) => compare(version, base) <= 0 : below(bump(given - 1));
    default:
      // `1.2.3` is exact, `1.2` / `1.2.x` covers the minor.
      return given === 3
        ? (version) => compare(version, base) === 0
        : (version) => atLeast(version) && below(bump(given - 1))(version);
  }
}

/** True when `range` is a semver range this module understands (see `satisfies`). */
export function isValidRange(range: string): boolean {
  return parseRange(range) !== null;
}

function parseRange(range: string): Comparator[][] | null {
  const alternatives = range.split('||').map((set) =>
    set
      .trim()
      .split(/\s+/)
      .filter((part) => part !== '')
      .map(parseComparator),
  );
  if (alternatives.some((set) => set.includes(null))) {
    return null;
  }
  return alternatives as Comparator[][];
}

/**
 * Does `version` satisfy the semver `range`? Supports the forms plugin manifests use:
 * `^`, `~`, `>=`, `>`, `<=`, `<`, exact and `x`-wildcard versions, space-separated
 * conjunctions and `||` alternatives. An unparsable version or range never matches.
 */
export function satisfies(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  const comparators = parseRange(range);
  if (!parsed || !comparators) {
    return false;
  }
  return comparators.some((set) => set.every((comparator) => comparator(parsed)));
}
