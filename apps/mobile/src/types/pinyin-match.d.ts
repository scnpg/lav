// pinyin-match ships a root index.d.ts for the default (simplified-Chinese)
// entry point only - no declaration for the traditional-Chinese subpath we
// actually import (search.ts uses this one since Lav's Taipei data is
// Traditional Chinese). Same shape as the root .d.ts, just for that path.
declare module "pinyin-match/lib/traditional.js" {
  const PinyinMatch: {
    match(input: string, keyword: string): [number, number] | false;
  };
  export default PinyinMatch;
}
