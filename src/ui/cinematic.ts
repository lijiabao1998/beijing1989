export {
  CHAPTER_META,
  JOURNALIST_META,
  RESIDENT_META,
  VIEWPOINT_LABELS,
  WORKER_META,
  getChapterMeta,
  getMetasForChapter,
  getMetasForViewpoint,
  type ChapterMeta,
  type StoryBeat,
} from '../data/routeMetas';

export {
  MAX_CACHED_IMAGES,
  chapterImages,
  drawChapterArtwork,
  getChapterImage,
  getSameDayMetas,
  mountChapterBanner,
  preloadRollingImages,
  preloadSameDayImages,
  resolveImageKey,
  type EffectiveLianhuanhuaLayout,
  type ReelArtworkOpts,
  type ReelViewStyle,
} from './reelArtwork';

export {
  REEL_SPEEDS,
  REEL_VIEW_STYLES,
  buildInterwovenPlaylist,
  buildRoutePlaylist,
  mountDocumentaryReel,
  type ReelMode,
  type ReelOptions,
  type ReelPlaylistItem,
} from './documentaryReel';

export {
  findNextTarget,
  isExitHotspot,
  isInTimeWindow,
  pickAutoChoice,
  type AutoGuideContext,
  type NextTargetInfo,
} from '../engine/autoGuide';

export {
  ITEM_LABELS,
  fullSpringChronicleHtml,
  summarizeCharactersForViewpoint,
} from './chronicle';

export { updateTimelineHud } from './hudTimeline';
