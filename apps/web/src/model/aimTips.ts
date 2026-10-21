import type { Aim } from "@repcurve/shared";
import type { SessionRecord } from "./types";

/**
 * Tips for the person's aim, outside the plan itself: one after each workout, each with the
 * research behind it. Claims stay inside what the cited studies found; supplements carry their
 * cautions. General guidance, not medical advice.
 */

export interface Source {
  cite: string;
  url: string;
}

export interface AimTip {
  id: string;
  aims: Aim[];
  title: string;
  /** One or two sentences, shown on the card. */
  short: string;
  /** "Learn more": the reasoning, a paragraph each. */
  more: string[];
  sources: Source[];
  /** Who should check with a doctor first, and other limits. */
  caution?: string;
}

export const AIM_LABEL: Record<Aim, string> = {
  lose_fat: "Lose fat",
  build_muscle: "Build muscle",
  get_stronger: "Get stronger",
  get_fitter: "Feel fitter and healthier",
};

/** The aims as setup asks about them. */
export const AIM_OPTIONS: { value: Aim; label: string; hint: string }[] = [
  { value: "lose_fat", label: AIM_LABEL.lose_fat, hint: "Lose weight and keep your muscle" },
  { value: "build_muscle", label: AIM_LABEL.build_muscle, hint: "Look and feel more muscular" },
  { value: "get_stronger", label: AIM_LABEL.get_stronger, hint: "Lift heavier, feel more capable" },
  { value: "get_fitter", label: AIM_LABEL.get_fitter, hint: "Energy, health and moving well" },
];

const doi = (d: string) => `https://doi.org/${d}`;

// Checked against the papers: what each supports is in the tip that cites it, and no more.
const S = {
  morton: { cite: "Morton RW et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. British Journal of Sports Medicine 52(6):376–384.", url: doi("10.1136/bjsports-2017-097608") },
  schoenfeldAragon: { cite: "Schoenfeld BJ, Aragon AA (2018). How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. Journal of the International Society of Sports Nutrition 15:10.", url: doi("10.1186/s12970-018-0215-1") },
  trommelen: { cite: "Trommelen J et al. (2023). The anabolic response to protein ingestion during recovery from exercise has no upper limit in magnitude and duration in vivo in humans. Cell Reports Medicine 4(12):101324.", url: doi("10.1016/j.xcrm.2023.101324") },
  kreider: { cite: "Kreider RB et al. (2017). International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. Journal of the International Society of Sports Nutrition 14:18.", url: doi("10.1186/s12970-017-0173-z") },
  antonio: { cite: "Antonio J et al. (2021). Common questions and misconceptions about creatine supplementation: what does the scientific evidence really show? Journal of the International Society of Sports Nutrition 18:13.", url: doi("10.1186/s12970-021-00412-w") },
  lanhers: { cite: "Lanhers C et al. (2017). Creatine supplementation and upper limb strength performance: a systematic review and meta-analysis. Sports Medicine 47(1):163–173.", url: doi("10.1007/s40279-016-0571-4") },
  wax: { cite: "Wax B et al. (2021). Creatine for exercise and sports performance, with recovery considerations for healthy populations. Nutrients 13(6):1915.", url: doi("10.3390/nu13061915") },
  paluch: { cite: "Paluch AE et al. (2022). Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. The Lancet Public Health 7(3):e219–e228.", url: doi("10.1016/S2468-2667(21)00302-9") },
  levine: { cite: "Levine JA (2002). Non-exercise activity thermogenesis (NEAT). Best Practice & Research Clinical Endocrinology & Metabolism 16(4):679–702.", url: doi("10.1053/beem.2002.0227") },
  herrmann: { cite: "Herrmann SD et al. (2024). 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. Journal of Sport and Health Science 13(1):6–12.", url: doi("10.1016/j.jshs.2023.10.010") },
  schumann: { cite: "Schumann M et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. Sports Medicine 52(3):601–612.", url: doi("10.1007/s40279-021-01587-7") },
  wilson: { cite: "Wilson JM et al. (2012). Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. Journal of Strength and Conditioning Research 26(8):2293–2307.", url: doi("10.1519/JSC.0b013e31823a3e2d") },
  cava: { cite: "Cava E, Yeat NC, Mittendorfer B (2017). Preserving healthy muscle during weight loss. Advances in Nutrition 8(3):511–519.", url: doi("10.3945/an.116.014506") },
  helms: { cite: "Helms ER, Aragon AA, Fitschen PJ (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. Journal of the International Society of Sports Nutrition 11:20.", url: doi("10.1186/1550-2783-11-20") },
  garthe: { cite: "Garthe I et al. (2011). Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. International Journal of Sport Nutrition and Exercise Metabolism 21(2):97–104.", url: doi("10.1123/ijsnem.21.2.97") },
  nedeltcheva: { cite: "Nedeltcheva AV et al. (2010). Insufficient sleep undermines dietary efforts to reduce adiposity. Annals of Internal Medicine 153(7):435–441.", url: doi("10.7326/0003-4819-153-7-201010050-00006") },
  knowles: { cite: "Knowles OE et al. (2018). Inadequate sleep and muscle strength: implications for resistance training. Journal of Science and Medicine in Sport 21(9):959–968.", url: doi("10.1016/j.jsams.2018.01.012") },
  grgic: { cite: "Grgic J et al. (2018). Effects of caffeine intake on muscle strength and power: a systematic review and meta-analysis. Journal of the International Society of Sports Nutrition 15:11.", url: doi("10.1186/s12970-018-0216-0") },
  guest: { cite: "Guest NS et al. (2021). International Society of Sports Nutrition position stand: caffeine and exercise performance. Journal of the International Society of Sports Nutrition 18:1.", url: doi("10.1186/s12970-020-00383-4") },
  efsa: { cite: "EFSA Panel on Dietetic Products, Nutrition and Allergies (2015). Scientific opinion on the safety of caffeine. EFSA Journal 13(5):4102.", url: doi("10.2903/j.efsa.2015.4102") },
  momma: { cite: "Momma H et al. (2022). Muscle-strengthening activities are associated with lower risk and mortality in major non-communicable diseases: a systematic review and meta-analysis of cohort studies. British Journal of Sports Medicine 56(13):755–763.", url: doi("10.1136/bjsports-2021-105061") },
  bull: { cite: "Bull FC et al. (2020). World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine 54(24):1451–1462.", url: doi("10.1136/bjsports-2020-102955") },
  mandsager: { cite: "Mandsager K et al. (2018). Association of cardiorespiratory fitness with long-term mortality among adults undergoing exercise treadmill testing. JAMA Network Open 1(6):e183605.", url: doi("10.1001/jamanetworkopen.2018.3605") },
  steinberg2013: { cite: "Steinberg DM et al. (2013). The efficacy of a daily self-weighing weight loss intervention using smart scales and e-mail. Obesity 21(9):1789–1797.", url: doi("10.1002/oby.20396") },
  steinberg2015: { cite: "Steinberg DM et al. (2015). Weighing every day matters: daily weighing improves weight loss and adoption of weight control behaviors. Journal of the Academy of Nutrition and Dietetics 115(4):511–518.", url: doi("10.1016/j.jand.2014.12.011") },
  iraki: { cite: "Iraki J et al. (2019). Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 7(7):154.", url: doi("10.3390/sports7070154") },
} satisfies Record<string, Source>;

const KIDNEYS = "If you have kidney disease, check with your doctor before eating more protein.";

export const AIM_TIPS: AimTip[] = [
  // ---------------------------------------------------------------- lose fat
  {
    id: "walk-more",
    aims: ["lose_fat"],
    title: "Walk more, on top of your lifting",
    short: "Adding 2,000–3,000 steps a day burns extra calories with little fatigue, so it's easy to recover from alongside your lifting.",
    more: [
      "Losing fat means eating a little less than you burn. That deficit is a stress your body handles on top of your workouts, so the extra activity you add should be easy to recover from.",
      "Hard cardio burns more calories but adds more fatigue. Most cardio doesn't hold back muscle or strength gains much, but a lot of it, especially in the same session as lifting, can. Walking hasn't been tested on its own against lifting, but at its low effort it's the gentlest way to move more, and it fits into a day in short bouts.",
      "2,000 extra steps is about 20 minutes of walking and burns roughly 80–100 calories for most adults. Everyday movement like this is one of the most variable parts of the calories people burn.",
      "You don't need exactly 10,000 steps. In large studies following people, the lower risk of death that goes with more steps levelled off at around 8,000–10,000 a day for adults under 60, and 6,000–8,000 for older adults. Start from your usual and add a couple of thousand.",
    ],
    sources: [S.paluch, S.levine, S.herrmann, S.schumann, S.wilson],
  },
  {
    id: "keep-lifting",
    aims: ["lose_fat"],
    title: "Keep lifting while you lose weight",
    short: "In a calorie deficit, strength training helps your body keep its muscle and strength, so more of the weight you lose is fat.",
    more: [
      "When people diet without exercise, a good share of the weight they lose can be muscle. Exercise, and lifting in particular, keeps more of it, and lifting keeps you strong as well. Enough protein helps too.",
      "That matters beyond looks: muscle keeps you capable, and it's hard to rebuild. So keep your sessions going while you diet, even short ones.",
    ],
    sources: [S.cava],
  },
  {
    id: "protein-diet",
    aims: ["lose_fat"],
    title: "Eat plenty of protein while dieting",
    short: "Protein helps you hold on to muscle and keeps you fuller. Aim for at least 1.6 g per kg of body weight a day (about 0.7 g per lb), a little more while dieting.",
    more: [
      "In research on people who lift, muscle gains from extra protein levelled off at about 1.6 g per kg of body weight a day on average. In a calorie deficit, experts recommend more than that to keep muscle, and protein is filling, which makes eating less easier.",
      "Spread it across your meals: a palm-sized portion of meat, fish, eggs, Greek yoghurt, tofu or beans at each one gets most people there.",
    ],
    sources: [S.morton, S.helms, S.cava],
    caution: KIDNEYS,
  },
  {
    id: "slow-loss",
    aims: ["lose_fat"],
    title: "Lose about 0.5–1% of your weight a week",
    short: "Slower weight loss keeps more muscle and strength than crash dieting, and it's easier to keep up.",
    more: [
      "In a study of athletes who all lost about the same amount, the group losing about 0.7% of body weight a week gained lean mass and got stronger on every lift tested. The group losing about 1.4% a week gained no lean mass and improved on only one lift.",
      "For most people, 0.5–1% a week means about 0.4–0.8 kg (1–2 lb) for someone weighing 80 kg (175 lb). If you're losing much faster than that, eat a little more.",
    ],
    sources: [S.garthe, S.helms],
  },
  {
    id: "sleep-diet",
    aims: ["lose_fat"],
    title: "Protect your sleep while dieting",
    short: "In a small study on the same diet, people lost about half as much fat, and more lean mass, with 5.5 hours in bed a night instead of 8.5.",
    more: [
      "Ten dieters spent two weeks with 8.5 hours in bed and two weeks with 5.5, eating the same reduced calories. With less sleep, the share of weight they lost as fat fell by 55%, and they lost 60% more fat-free mass (muscle, water and other lean tissue). They were hungrier too.",
      "It was a small study, but the message fits wider research on sleep: a regular bedtime and 7 or more hours in bed make a diet work better.",
    ],
    sources: [S.nedeltcheva],
  },
  {
    id: "weigh-often",
    aims: ["lose_fat"],
    title: "Weigh yourself often, and watch the trend",
    short: "Your weight jumps around day to day with water and food. Weighing often and watching the weekly average shows what's really happening.",
    more: [
      "A single weigh-in can be a kilo or more off because of salt, carbohydrates, water and digestion. The average of several days smooths that out.",
      "Daily weighing, especially with feedback on the trend, is linked to more weight lost: in one trial, people given daily weighing with smart scales and emailed feedback lost about 6.5% of their weight in six months, against almost none in the comparison group. Weigh at the same time each day, like in the morning after the bathroom.",
    ],
    sources: [S.steinberg2013, S.steinberg2015],
  },
  // ---------------------------------------------------------------- build muscle and get stronger
  {
    id: "protein",
    aims: ["build_muscle", "get_stronger"],
    title: "Get enough protein",
    short: "About 1.6 g of protein per kg of body weight a day (about 0.7 g per lb) gets most of the muscle-building benefit.",
    more: [
      "A large analysis of 49 studies on people who lift found that muscle gains from extra protein levelled off at about 1.6 g per kg of body weight a day on average. Some people may benefit from up to about 2.2 g per kg.",
      "Food is enough: meat, fish, eggs, dairy, tofu, beans and lentils. Protein shakes are just a convenient way to top up.",
    ],
    sources: [S.morton],
    caution: KIDNEYS,
  },
  {
    id: "protein-meals",
    aims: ["build_muscle"],
    title: "Spread protein across your meals",
    short: "Eating protein at three or four meals, rather than mostly at one, is an easy way to reach your daily total and keep feeding your muscles.",
    more: [
      "A practical target from researchers is about 0.4 g per kg of body weight at each of four meals, which adds up to around 1.6 g per kg a day. For an 80 kg person that's roughly 30–35 g a meal: a chicken breast, a tin of tuna, or a big bowl of Greek yoghurt.",
      "It's a target, not a limit: your body can use more at once than once thought, and a large dose keeps working for hours. The daily total matters most.",
    ],
    sources: [S.schoenfeldAragon, S.trommelen],
  },
  {
    id: "creatine",
    aims: ["build_muscle", "get_stronger"],
    title: "Consider creatine",
    short: "3–5 grams of creatine monohydrate a day is the most studied supplement for training, and it's safe for healthy adults.",
    more: [
      "Creatine helps your muscles make energy for short, hard efforts like a heavy set. Taken alongside training, it adds a modest but consistent extra gain in strength and lean mass, in many studies and in analyses that pool them.",
      "Take 3–5 g of plain creatine monohydrate every day, with any meal. You don't need a loading phase or to time it around workouts: at this dose it builds up in your muscles over about 3–4 weeks.",
      "Expect the scale to go up a little: creatine draws water into your muscles. People who load with 20 g a day often gain 1–2 kg in the first week; at 3–5 g a day it's slower and smaller. That's water, not fat.",
    ],
    sources: [S.kreider, S.antonio, S.lanhers, S.wax],
    caution: "Check with your doctor first if you have kidney disease, are pregnant, or take regular medication.",
  },
  {
    id: "small-surplus",
    aims: ["build_muscle"],
    title: "Eat a little more than you burn",
    short: "Muscle grows best with a small calorie surplus: gaining about 0.25–0.5% of your body weight a week.",
    more: [
      "Building muscle takes energy, so eating slightly more than you burn helps, especially once you're past the beginner stage. Experts suggest a surplus of about 10–20% of your calories for newer lifters, and smaller for experienced ones. A big surplus mostly adds fat.",
      "Weigh yourself regularly. If your weekly average isn't moving after a few weeks, add a snack; if it's climbing fast, ease off.",
    ],
    sources: [S.iraki],
  },
  {
    id: "sleep-strength",
    aims: ["build_muscle", "get_stronger"],
    title: "Sleep is part of your training",
    short: "Several short nights in a row can sap your strength on big lifts. Aim for 7 or more hours a night.",
    more: [
      "One bad night makes little difference to strength. But in studies that cut people's sleep for several nights, strength on multi-joint lifts like squats and presses dropped. The research is limited, but it points the same way as everything else known about sleep and recovery.",
      "A regular bedtime, a dark, cool room and less caffeine late in the day all help.",
    ],
    sources: [S.knowles],
  },
  {
    id: "caffeine",
    aims: ["get_stronger"],
    title: "Coffee before lifting can help",
    short: "Caffeine about an hour before training makes people a little stronger on average. Around 200 mg, about two cups of coffee, is plenty.",
    more: [
      "Analyses of many studies find caffeine raises strength by a small but real amount. Studies use 3–6 mg per kg of body weight about an hour before training; the low end, about 3 mg per kg, works for most people and keeps you within safe limits.",
      "European food safety experts consider single doses up to 200 mg safe for healthy adults, including before hard exercise, and up to 400 mg across a day. Skip it for evening workouts if it keeps you awake: lost sleep costs more than caffeine gives.",
    ],
    sources: [S.grgic, S.guest, S.efsa],
    caution: "Limit caffeine to 200 mg a day if you're pregnant, and check with your doctor if you have a heart condition or high blood pressure, or are sensitive to it.",
  },
  // ---------------------------------------------------------------- feel fitter and healthier
  {
    id: "steps-health",
    aims: ["get_fitter"],
    title: "Walk more every day",
    short: "More daily steps go with a lower risk of dying early, up to about 8,000–10,000 a day for adults under 60 (6,000–8,000 for older adults).",
    more: [
      "A large analysis of studies following 47,000 people found that the more steps people took each day, the lower their risk of death during follow-up, levelling off around those numbers. Studies like this show a link rather than prove cause, but the link is strong and consistent.",
      "Start from what you do now and add a little: a walk after meals, the stairs, a stop further away.",
    ],
    sources: [S.paluch],
  },
  {
    id: "weekly-activity",
    aims: ["get_fitter"],
    title: "Aim for 150 minutes a week",
    short: "The World Health Organization recommends 150–300 minutes of moderate activity a week, or 75–150 of vigorous, plus strength training on 2 or more days.",
    more: [
      "Moderate means you can talk but not sing: brisk walking, cycling, swimming. Vigorous means only a few words at a time. Your RepCurve sessions count toward the strength part.",
      "Any amount is better than none, and more brings more benefit. The weekly activity card on Progress keeps count for you.",
    ],
    sources: [S.bull],
  },
  {
    id: "lifting-health",
    aims: ["get_fitter"],
    title: "Lifting is good for your health, not just your muscles",
    short: "Muscle-strengthening exercise for 30–60 minutes a week is linked with a 10–20% lower risk of dying early, and of heart disease and cancer.",
    more: [
      "A pooled analysis of 16 long-term studies found the biggest reduction in risk at around 30–60 minutes of strength training a week, with no clear extra benefit beyond that. These studies show a link rather than prove cause.",
      "So your sessions do more than build strength. Keep them going, even short ones on a busy week.",
    ],
    sources: [S.momma],
  },
  {
    id: "fitness-life",
    aims: ["get_fitter"],
    title: "Fitness is one of the best signs of a long life",
    short: "In over 120,000 adults who had a treadmill test, the fitter they were, the lower their risk of death, with no upper limit.",
    more: [
      "Cardiorespiratory fitness is how well your heart and lungs supply your muscles. In this study, people in the fittest group had about a fifth of the risk of death of those in the least fit group during follow-up. It was a group of patients sent for testing, and it shows a link rather than proves cause.",
      "Fitness is very trainable: regular brisk walks and your cardio days build it week by week.",
    ],
    sources: [S.mandsager],
  },
];

/** The tips for an aim, in the order they come up. */
export const tipsFor = (aim: Aim): AimTip[] => AIM_TIPS.filter((t) => t.aims.includes(aim));

/**
 * The tip after a workout: the next one in turn, counted by workouts done, so each comes up once
 * before any repeats and the same workout always shows the same tip.
 */
export function tipAfter(aim: Aim, record: SessionRecord, history: SessionRecord[]): AimTip {
  const tips = tipsFor(aim);
  const done = history.filter((r) => !r.skipped && r.finishedAt <= record.finishedAt && r.id !== record.id).length;
  return tips[done % tips.length]!;
}
