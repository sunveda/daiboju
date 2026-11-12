// The 47 prefectures. `ja` matches the `pref` field in JMA / P2P Earthquake Information data.
export const PREFECTURES = [
  ['01', '北海道', 'Hokkaido'], ['02', '青森県', 'Aomori'], ['03', '岩手県', 'Iwate'], ['04', '宮城県', 'Miyagi'],
  ['05', '秋田県', 'Akita'], ['06', '山形県', 'Yamagata'], ['07', '福島県', 'Fukushima'], ['08', '茨城県', 'Ibaraki'],
  ['09', '栃木県', 'Tochigi'], ['10', '群馬県', 'Gunma'], ['11', '埼玉県', 'Saitama'], ['12', '千葉県', 'Chiba'],
  ['13', '東京都', 'Tokyo'], ['14', '神奈川県', 'Kanagawa'], ['15', '新潟県', 'Niigata'], ['16', '富山県', 'Toyama'],
  ['17', '石川県', 'Ishikawa'], ['18', '福井県', 'Fukui'], ['19', '山梨県', 'Yamanashi'], ['20', '長野県', 'Nagano'],
  ['21', '岐阜県', 'Gifu'], ['22', '静岡県', 'Shizuoka'], ['23', '愛知県', 'Aichi'], ['24', '三重県', 'Mie'],
  ['25', '滋賀県', 'Shiga'], ['26', '京都府', 'Kyoto'], ['27', '大阪府', 'Osaka'], ['28', '兵庫県', 'Hyogo'],
  ['29', '奈良県', 'Nara'], ['30', '和歌山県', 'Wakayama'], ['31', '鳥取県', 'Tottori'], ['32', '島根県', 'Shimane'],
  ['33', '岡山県', 'Okayama'], ['34', '広島県', 'Hiroshima'], ['35', '山口県', 'Yamaguchi'], ['36', '徳島県', 'Tokushima'],
  ['37', '香川県', 'Kagawa'], ['38', '愛媛県', 'Ehime'], ['39', '高知県', 'Kochi'], ['40', '福岡県', 'Fukuoka'],
  ['41', '佐賀県', 'Saga'], ['42', '長崎県', 'Nagasaki'], ['43', '熊本県', 'Kumamoto'], ['44', '大分県', 'Oita'],
  ['45', '宮崎県', 'Miyazaki'], ['46', '鹿児島県', 'Kagoshima'], ['47', '沖縄県', 'Okinawa'],
].map(([code, ja, en]) => ({ code, ja, en, short: ja === '北海道' ? '北海道' : ja.replace(/[都府県]$/, '') }));

const byCode = new Map(PREFECTURES.map((p) => [p.code, p]));

export function prefByCode(code) {
  return byCode.get(String(code).padStart(2, '0')) || null;
}

/** Resolve a JMA prefecture string ("東京都", "東京", "Tokyo") to a prefecture. */
export function matchPref(name) {
  if (!name) return null;
  const n = String(name).trim();
  return (
    PREFECTURES.find((p) => p.ja === n || p.short === n || p.en.toLowerCase() === n.toLowerCase()) ||
    PREFECTURES.find((p) => n.startsWith(p.short)) ||
    null
  );
}

// JMA tsunami forecast regions that do not contain a prefecture name.
// Regions like "岩手県" or "千葉県九十九里・外房" are matched by name automatically.
// TODO(argon): complete this table against the JMA list of 66 tsunami forecast regions.
const TSUNAMI_REGIONS = {
  東京湾内湾: ['13', '12', '14'],
  伊豆諸島: ['13'],
  小笠原諸島: ['13'],
  相模湾・三浦半島: ['14'],
  伊勢・三河湾: ['23', '24'],
  大阪府: ['27'],
  淡路島南部: ['28'],
  瀬戸内海沿岸: ['28', '33', '34', '35', '36', '37', '38'],
  有明・八代海: ['40', '41', '42', '43'],
  陸奥湾: ['02'],
  津軽海峡: ['01', '02'],
  佐渡: ['15'],
  隠岐: ['32'],
  壱岐・対馬: ['42'],
  種子島・屋久島地方: ['46'],
  奄美群島・トカラ列島: ['46'],
  沖縄本島地方: ['47'],
  大東島地方: ['47'],
  宮古島・八重山地方: ['47'],
};

/** Prefectures covered by a JMA tsunami forecast region name. */
export function tsunamiRegionPrefs(region) {
  if (!region) return [];
  if (TSUNAMI_REGIONS[region]) return TSUNAMI_REGIONS[region].map(prefByCode);
  const hit = PREFECTURES.filter((p) => region.includes(p.short));
  return hit;
}
