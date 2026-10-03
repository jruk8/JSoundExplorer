// English strings, separate from code for fast editing. Nested key shape
// mirrors a Crowdin-ready JSON locale 1:1 (convert with any JSON dump);
// {name} placeholders render via formatString. Protocol text (JMHScript
// commands and output, count units) intentionally stays in code.

/** Fill {name} placeholders; unknown names render empty. */
export function formatString(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export const en = {
  app: {
    title: 'JSoundExplorer',
    tagline: 'The most over-engineered sound explorer for MC{version}.',
    taglineOffline: 'Offline Sound Explorer',
    taglineLoading: 'Loading Sound Explorer',
    taglineOnline: 'Online Sound Explorer',
    linksLabel: 'Project links',
    githubLink: '» GitHub',
    jmanhuntLink: '» JManhunt',
  },
  footer: {
    text: 'Privacy: play counts are anonymous per-sound totals. No accounts, no cookies, no tracking identifiers. Preferences stay in your browser; sounds stream from Mojang\'s CDN; server logs may note IPs like any web server. Questions: see ',
    link: 'jruk8/JSoundExplorer on GitHub',
    suffix: '.',
  },
  sidebar: {
    navLabel: 'Sound namespaces',
    turnAllOff: 'Turn all off',
    turnAllOn: 'Turn all on',
    surprise: 'Surprise me!',
    swipe: 'Swipe!',
    alsoPitch: 'also pitch',
    classical: 'Play Classical!',
    classicalStop: 'Stop the classical piece',
  },
  controls: {
    searchCaption: 'Search',
    searchPlaceholder: 'Filter sounds…',
    searchLabel: 'Search sounds',
    pitchCaption: 'Pitch',
    volumeCaption: 'Volume',
    sortCaption: 'Sort',
    sortLabel: 'Sort sounds',
    pitchValue: '{value}x',
    volumeValue: '{value}%',
  },
  sort: {
    none: 'None',
    most: 'Most Played',
    least: 'Least Played',
  },
  list: {
    loading: 'Loading sounds…',
    empty: 'No sounds match.',
    copied: 'copied to clipboard',
  },
  options: {
    title: 'Options',
    panelLabel: 'Options',
    jmhLabel: 'JMHScript Sound',
    copyLabel: 'Copy JMHScript',
    commandLabel: 'JMHScript command',
    historyTitle: 'History',
    historyEmpty: 'No history yet.',
    historyUp: 'Scroll history up',
    historyDown: 'Scroll history down',
    hourlyTitle: 'Hourly Sounds Played',
    // Label/value order is fixed (label first); the value renders apart in
    // brand red, so this stays two keys rather than one template.
    globalPlaysLabel: 'Global Plays:',
    hourlyChartLabel: 'Hourly sounds played, {total} in the last 8 hours',
    dailyTitle: 'Daily Sounds Played',
    dailyChartLabel: 'Daily sounds played, {total} in the last 7 days',
    monthlyTitle: 'Monthly Sounds Played',
    monthlyChartLabel: 'Monthly sounds played, {total} in the last 12 months',
  },
  vault: {
    title: 'JSoundExplorer',
    subtitle: 'Minecraft sounds for {version}',
    subtitleUnknown: 'Minecraft sounds',
  },
  swipe: {
    round: 'Round {n}',
    dialogLabel: 'Swipe game',
    play: 'Play sound',
    stop: 'Stop sound',
  },
  time: {
    am: 'AM',
    pm: 'PM',
  },
}

export type LocaleStrings = typeof en;
