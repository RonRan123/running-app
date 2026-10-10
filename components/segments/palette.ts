// One color per segment, stable by rank — used by the map, cards and charts.
export const SEGMENT_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2']

export const segmentColor = (rank: number) => SEGMENT_COLORS[rank % SEGMENT_COLORS.length]
