// Fixed, human-written texts. The first alert ALWAYS comes from here, never from AI,
// because it must go out in seconds and its wording must be checked in advance.
// SAFETY: have native speakers review every translation before a public launch.

export const LANGUAGES = {
  en: 'English', ja: '日本語', zh: '中文(简体)', ko: '한국어', vi: 'Tiếng Việt', pt: 'Português', es: 'Español',
  // Argon-only: the first alert falls back to English, the next steps are written in this language.
  ne: 'नेपाली', id: 'Bahasa Indonesia', th: 'ไทย', tl: 'Tagalog', my: 'မြန်မာ', hi: 'हिन्दी', fr: 'Français', de: 'Deutsch',
};
export const TEMPLATE_LANGS = ['en', 'ja', 'zh', 'ko', 'vi', 'pt', 'es'];

const STAGE1 = {
  earthquake: {
    en: 'EARTHQUAKE. Drop, cover, hold on. Get under a sturdy table or protect your head. Stay away from windows and shelves. Do not run outside while it shakes. Next steps will follow.',
    ja: '【地震】すぐに身を守ってください。机の下に入るか頭を守り、窓や棚から離れてください。揺れている間は外に飛び出さないでください。次の行動を続けてお知らせします。',
    zh: '【地震】立即趴下、掩护、抓牢。躲到坚固的桌子下或护住头部，远离窗户和柜子。摇晃时不要跑到室外。后续指引将随后发送。',
    ko: '【지진】즉시 몸을 낮추고 머리를 보호하고 붙잡으세요. 튼튼한 탁자 아래로 들어가고 창문과 선반에서 떨어지세요. 흔들리는 동안 밖으로 뛰어나가지 마세요. 다음 안내가 곧 전송됩니다.',
    vi: '【ĐỘNG ĐẤT】Hãy cúi xuống, che chắn và bám chắc. Chui xuống gầm bàn chắc chắn hoặc che đầu. Tránh xa cửa kính và kệ. Không chạy ra ngoài khi đang rung. Hướng dẫn tiếp theo sẽ được gửi sau.',
    pt: 'TERREMOTO. Abaixe-se, proteja-se e segure-se. Fique sob uma mesa firme ou proteja a cabeça. Afaste-se de janelas e prateleiras. Não corra para fora durante o tremor. Próximos passos a seguir.',
    es: 'TERREMOTO. Agáchate, cúbrete y sujétate. Métete bajo una mesa firme o protege tu cabeza. Aléjate de ventanas y estanterías. No salgas corriendo mientras tiembla. Te enviaremos los siguientes pasos.',
  },
  tsunami: {
    en: 'TSUNAMI WARNING. If you are near the coast or a river, leave NOW. Go to high ground or the upper floors of a tall concrete building. Do not wait, do not go back for belongings, do not go to see the sea.',
    ja: '【津波警報】海岸や川の近くにいる人は、今すぐ離れて高台や頑丈な高い建物の上の階へ避難してください。待たずに、荷物を取りに戻らず、海を見に行かないでください。',
    zh: '【海啸警报】如果您在海岸或河流附近，请立即离开！前往高地或坚固高楼的高层。不要等待，不要回去拿东西，不要去看海。',
    ko: '【쓰나미 경보】해안이나 강 근처에 있다면 지금 즉시 벗어나세요. 높은 곳이나 튼튼한 고층 건물의 위층으로 대피하세요. 기다리지 말고, 짐을 가지러 돌아가지 말고, 바다를 보러 가지 마세요.',
    vi: '【CẢNH BÁO SÓNG THẦN】Nếu bạn ở gần bờ biển hoặc sông, hãy rời đi NGAY. Lên chỗ cao hoặc tầng trên của tòa nhà bê tông cao. Không chờ đợi, không quay lại lấy đồ, không đi xem biển.',
    pt: 'ALERTA DE TSUNAMI. Se você está perto da costa ou de um rio, saia AGORA. Vá para um lugar alto ou para os andares superiores de um prédio alto de concreto. Não espere, não volte para buscar pertences, não vá ver o mar.',
    es: 'ALERTA DE TSUNAMI. Si estás cerca de la costa o de un río, aléjate YA. Ve a un lugar alto o a los pisos superiores de un edificio alto de concreto. No esperes, no vuelvas por tus cosas, no vayas a mirar el mar.',
  },
  rain: {
    en: 'HEAVY RAIN / FLOOD. Stay away from rivers, slopes and underground spaces. Prepare to evacuate. If water is already outside, move to an upper floor. Next steps will follow.',
    ja: '【大雨・洪水】川・がけ・地下には近づかないでください。避難の準備をしてください。すでに外が浸水している場合は、建物の上の階へ移動してください。次の行動を続けてお知らせします。',
    zh: '【暴雨・洪水】远离河流、山坡和地下空间。做好避难准备。如果外面已经积水，请移动到楼上。后续指引将随后发送。',
    ko: '【호우・홍수】강, 비탈, 지하 공간에 가까이 가지 마세요. 대피 준비를 하세요. 이미 밖이 침수되었다면 건물 위층으로 이동하세요. 다음 안내가 곧 전송됩니다.',
    vi: '【MƯA LỚN / LŨ】Tránh xa sông, sườn dốc và không gian ngầm. Chuẩn bị sơ tán. Nếu bên ngoài đã ngập, hãy lên tầng trên. Hướng dẫn tiếp theo sẽ được gửi sau.',
    pt: 'CHUVA FORTE / ENCHENTE. Fique longe de rios, encostas e locais subterrâneos. Prepare-se para evacuar. Se a água já estiver lá fora, suba para um andar superior. Próximos passos a seguir.',
    es: 'LLUVIA FUERTE / INUNDACIÓN. Aléjate de ríos, laderas y espacios subterráneos. Prepárate para evacuar. Si el agua ya está afuera, sube a un piso superior. Te enviaremos los siguientes pasos.',
  },
  typhoon: {
    en: 'TYPHOON. Stay indoors away from windows. Do not go outside to check rivers, the sea or your roof. Charge your phone and keep water and a light ready. Next steps will follow.',
    ja: '【台風】屋内にとどまり、窓から離れてください。川・海・屋根の様子を見に外に出ないでください。スマホを充電し、水と明かりを用意してください。次の行動を続けてお知らせします。',
    zh: '【台风】留在室内，远离窗户。不要外出查看河流、海边或屋顶。给手机充电，备好饮用水和照明。后续指引将随后发送。',
    ko: '【태풍】실내에 머물고 창문에서 떨어지세요. 강, 바다, 지붕을 확인하러 나가지 마세요. 휴대폰을 충전하고 물과 조명을 준비하세요. 다음 안내가 곧 전송됩니다.',
    vi: '【BÃO】Ở trong nhà, tránh xa cửa sổ. Không ra ngoài xem sông, biển hay mái nhà. Sạc điện thoại, chuẩn bị nước và đèn. Hướng dẫn tiếp theo sẽ được gửi sau.',
    pt: 'TUFÃO. Fique em casa, longe das janelas. Não saia para ver rios, o mar ou o telhado. Carregue o celular e deixe água e uma lanterna à mão. Próximos passos a seguir.',
    es: 'TIFÓN. Quédate dentro, lejos de las ventanas. No salgas a revisar ríos, el mar o el techo. Carga tu teléfono y ten agua y una linterna a mano. Te enviaremos los siguientes pasos.',
  },
  other: {
    en: 'EMERGENCY ALERT for your area. Protect yourself and follow official instructions. Next steps will follow.',
    ja: '【緊急】お住まいの地域に警報が出ています。身の安全を確保し、公式の指示に従ってください。次の行動を続けてお知らせします。',
    zh: '【紧急警报】您所在地区已发布警报。请保护好自己并听从官方指示。后续指引将随后发送。',
    ko: '【긴급 경보】지역에 경보가 발령되었습니다. 안전을 확보하고 공식 지시에 따르세요. 다음 안내가 곧 전송됩니다.',
    vi: '【CẢNH BÁO KHẨN CẤP】Khu vực của bạn có cảnh báo. Hãy bảo vệ bản thân và làm theo hướng dẫn chính thức. Hướng dẫn tiếp theo sẽ được gửi sau.',
    pt: 'ALERTA DE EMERGÊNCIA na sua região. Proteja-se e siga as instruções oficiais. Próximos passos a seguir.',
    es: 'ALERTA DE EMERGENCIA en tu zona. Protégete y sigue las instrucciones oficiales. Te enviaremos los siguientes pasos.',
  },
};
STAGE1.landslide = STAGE1.rain;
STAGE1.volcano = STAGE1.other;

export function stage1Text(hazard, lang) {
  const t = STAGE1[hazard] || STAGE1.other;
  return t[lang] || t.en;
}

// Fallback next steps, used when Argon is slow, down or returns something invalid.
// English and Japanese only for now; other languages get English.
const STAGE2 = {
  high_ground_now: {
    en: { title: 'Tsunami: go to high ground now', steps: ['Go to high ground or the 3rd floor or higher of a sturdy concrete building.', 'Do not use a car unless you cannot walk.', 'Stay there until the warning is lifted. More waves can come for hours.'] },
    ja: { title: '津波：今すぐ高い所へ', steps: ['高台か、頑丈な鉄筋コンクリートの建物の3階以上へ避難してください。', '歩ける人は車を使わないでください。', '警報が解除されるまで戻らないでください。津波は何度も来ます。'] },
  },
  leave_coast: {
    en: { title: 'Tsunami advisory: leave the water and shore', steps: ['Get out of the sea and away from beaches and river mouths.', 'Do not go fishing, swimming or sightseeing at the coast.', 'Stay away until the advisory is lifted.'] },
    ja: { title: '津波注意報：海から離れて', steps: ['海の中や海岸、河口から離れてください。', '釣り・海水浴・見物で海に近づかないでください。', '注意報が解除されるまで近づかないでください。'] },
  },
  coast_high_ground: {
    en: { title: 'Near the coast or a river? Go to high ground now', steps: ['If you are near the sea or a river mouth, go to high ground or the 3rd floor or higher of a sturdy concrete building now.', 'Do not wait for the official tsunami forecast and do not go to look at the sea.', 'If you are inland, check your building for damage and watch for aftershocks.'] },
    ja: { title: '海や川の近くなら、今すぐ高い所へ', steps: ['海岸や河口の近くにいる人は、今すぐ高台か頑丈な建物の3階以上へ避難してください。', '津波の発表を待たず、海を見に行かないでください。', '内陸にいる人は建物の被害を確認し、余震に注意してください。'] },
  },
  check_building: {
    en: { title: 'Strong shaking: check your building', steps: ['When the shaking stops, check for fire and turn off the gas if safe.', 'If the building is damaged, leaning or smells of gas, leave carefully and go to an evacuation site.', 'If it is safe, stay inside. Strong aftershocks can follow.', 'Wear shoes: there may be broken glass.'] },
    ja: { title: '強い揺れ：建物を確認', steps: ['揺れが収まったら火の元を確認し、安全ならガスを止めてください。', '建物が壊れている・傾いている・ガスの臭いがする場合は、落ち着いて避難場所へ。', '安全なら建物の中にとどまってください。強い余震に注意。', 'ガラスの破片に備えて靴をはいてください。'] },
  },
  stay_alert: {
    en: { title: 'Earthquake: stay where you are if safe', steps: ['Stay away from windows and tall furniture.', 'Check for fire and gas.', 'Be ready for aftershocks in the coming days.'] },
    ja: { title: '地震：安全ならその場にとどまって', steps: ['窓や背の高い家具から離れてください。', '火の元とガスを確認してください。', '数日間は余震に注意してください。'] },
  },
  evacuate_now: {
    en: { title: 'Evacuate now', steps: ['Go to an evacuation site now, while it is still safe to walk.', 'Avoid rivers, slopes and underpasses on the way.', 'If outside is already dangerous, move to the highest floor away from slopes instead.'] },
    ja: { title: '今すぐ避難', steps: ['安全に歩けるうちに、今すぐ避難場所へ移動してください。', '途中、川・がけ・アンダーパスを避けてください。', '外がすでに危険なら、がけから離れた建物の上の階へ移動してください。'] },
  },
  safest_place_now: {
    en: { title: 'Disaster is happening: get to the safest spot now', steps: ['Do not go outside if it is dangerous.', 'Move to the highest room on the side away from slopes and rivers.', 'Call 119 if you are trapped or hurt.'] },
    ja: { title: '災害発生：今いる場所で最も安全な所へ', steps: ['外が危険なら外に出ないでください。', 'がけや川から離れた側の、一番高い部屋へ移動してください。', '閉じ込められたりケガをしたら119番へ。'] },
  },
  prepare: {
    en: { title: 'Get ready to evacuate', steps: ['Pack water, medicine, phone charger and documents.', 'Older people, people with disabilities and families with small children: start evacuating now.', 'Check the route to your nearest evacuation site.'] },
    ja: { title: '避難の準備を', steps: ['水・薬・充電器・大切な書類を準備してください。', '高齢者・障がいのある人・小さな子どもがいる家庭は今すぐ避難を始めてください。', '最寄りの避難場所までの道を確認してください。'] },
  },
  shelter_indoors: {
    en: { title: 'Stay indoors until it passes', steps: ['Keep away from windows; close curtains or shutters.', 'Do not go outside to check rivers, the sea or your roof.', 'Evacuate only if you are told to or your home becomes unsafe.'] },
    ja: { title: '通り過ぎるまで屋内に', steps: ['窓から離れ、カーテンや雨戸を閉めてください。', '川・海・屋根の様子を見に外に出ないでください。', '避難指示が出たり家が危険になったら避難してください。'] },
  },
  follow_officials: {
    en: { title: 'Follow official instructions', steps: ['Protect yourself first.', 'Follow instructions from the city and the police or fire services.'] },
    ja: { title: '公式の指示に従って', steps: ['まず身の安全を確保してください。', '市区町村・警察・消防の指示に従ってください。'] },
  },
};

export function fallbackGuidance(action, lang) {
  const t = STAGE2[action] || STAGE2.follow_officials;
  const g = t[lang] || t.en;
  return { title: g.title, summary: g.steps[0], steps: g.steps, avoid: [], sms: `${g.title}. ${g.steps[0]}`, by: 'template' };
}

const UI = {
  nextSteps: { en: 'Your next steps and nearest safe place', ja: '次の行動と最寄りの避難場所', zh: '下一步行动和最近的避难场所', ko: '다음 행동과 가장 가까운 대피소', vi: 'Bước tiếp theo và nơi sơ tán gần nhất', pt: 'Próximos passos e local seguro mais próximo', es: 'Tus próximos pasos y el lugar seguro más cercano' },
  drill: { en: '[DRILL] ', ja: '【訓練】', zh: '【演练】', ko: '【훈련】', vi: '[DIỄN TẬP] ', pt: '[SIMULADO] ', es: '[SIMULACRO] ' },
  stop: { en: 'Stop alerts', ja: '配信停止', zh: '取消提醒', ko: '수신 중지', vi: 'Ngừng nhận', pt: 'Parar alertas', es: 'Dejar de recibir' },
  registered: {
    en: 'Daiboju is set up. You will get alerts for your area in this language. Send STOP any time to delete your data.',
    ja: 'Daibojuの登録が完了しました。お住まいの地域の警報をこの言語でお届けします。STOPと送ればいつでもデータを削除できます。',
  },
  deleted: { en: 'Your data has been deleted. You will not get more alerts.', ja: 'データを削除しました。今後、通知は届きません。' },
};

export function ui(key, lang) {
  return UI[key]?.[lang] || UI[key]?.en || '';
}
