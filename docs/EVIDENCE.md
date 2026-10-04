# RepCurve evidence check

Last reviewed: 2026-10-04

**How to read this.** Verdicts are supported, partly supported, not supported or unclear. I found and read the sources through web-search extracts of PubMed, PMC, journal and SportRxiv pages, which show abstract or full-text passages. The sandbox's network policy blocked direct page and PDF fetches, so the quotes are the wording those extracts showed. Before shipping user-facing copy, spot-check the quotes against the papers. "[est]" marks my own engineering estimate. "[unverified]" marks a number I could not confirm in a source. Lines marked **Engine** are design choices drawn from the evidence; no study reported them unless a line says so. "Sets" means hard sets per muscle per week, counted fractionally: a direct set counts 1 and a set for an assisting muscle counts 0.5, as in Pelland 2026.

---

## 1. Weekly hard sets per muscle
**Claim:** novices ~8–10, intermediates ~12–16, advanced ~16–20+, with diminishing returns.
**Verdict: partly supported.** The concave dose-response is solid. The tiers by training status are a coaching heuristic; no meta-analysis gives optima by training status.
**Numbers:** Schoenfeld 2017: +0.37% muscle size per weekly set. By category: <5 sets 5.4%, 5–9 sets 6.6%, 10+ sets 9.8% [category values from a secondary summary]. Pelland 2026 (67 studies, n=2,058): the square-root model fit hypertrophy best, with a marginal gain of +0.24% per set at a mean of 12.25 sets (95% CrI 0.15–0.33%). Strength flattens much sooner. A secondary extract also reports "no detectable superiority beyond ~31 (hypertrophy) / ~3 (strength) fractional sets/wk" [unverified wording].
**Quote:** "both best fit models suggest diminishing returns, with the diminishing returns for strength being considerably more pronounced."
**Sources:** Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC (2026). The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains. *Sports Med* 56:481–505. https://doi.org/10.1007/s40279-025-02344-w · Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci* 35:1073–1082. https://doi.org/10.1080/02640414.2016.1210197
**Engine:** hypertrophy relative effect = (S/10)^0.4 and strength = (S/10)^0.25 [est]. Novice default is 6–10 fractional sets; about 12 is the practical ceiling in 3×20 min.

## 2. Proximity to failure (RIR)
**Claim:** sets at ~0–3 RIR count fully for hypertrophy; strength is less sensitive.
**Verdict: partly supported.** The direction holds and strength is insensitive to RIR. No study measured a "0–3 counts fully" threshold.
**Numbers:** Robinson 2024 (55 hypertrophy and 67 strength studies): hypertrophy rises as sets end closer to failure, and strength is similar across RIR. Refalo 2023: failure vs non-failure ES 0.19 (95% CI 0.00–0.37), a trivial difference. Refalo 2024 RCT: training to failure and stopping at 1–2 RIR gave similar quadriceps growth.
**Quote:** "...the relationship between proximity to failure and strength gain appears to differ from the relationship with muscle hypertrophy, with only the latter being meaningfully influenced by RIR."
**Sources:** Robinson ZP, Pelland JC, Remmert JF, et al. (2024). Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions. *Sports Med* 54:2209–2231. https://doi.org/10.1007/s40279-024-02069-2 · Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ (2023). Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis. *Sports Med* 53:649–665. https://doi.org/10.1007/s40279-022-01784-y
**Engine:** hypertrophy credit by RIR: 0–2 → 1.0, 3 → 0.9, 4 → 0.75, 5 → 0.6, ≥6 → 0.35 [est]. Strength credit: 1.0 up to RIR 5, then 0.8. Target 1–3 RIR.

## 3. Load range
**Claim:** ~30–85% 1RM all build muscle if taken near failure; heavier loads favour strength.
**Verdict: supported.**
**Numbers:** Schoenfeld 2017 (21 studies, ≤60% vs >60% 1RM, all sets to failure): similar hypertrophy, larger 1RM gains with heavy loads. Lopez 2021 network meta-analysis (>15RM, 9–15RM, ≤8RM): no difference in hypertrophy, more strength with high loads. Currier 2023: >80% 1RM maximised strength.
**Quote:** "maximal strength benefits are obtained from the use of heavy loads while muscle hypertrophy can be equally achieved across a spectrum of loading ranges."
**Sources:** Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW (2017). Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis. *J Strength Cond Res* 31:3508–3523. https://doi.org/10.1519/JSC.0000000000002200 · Lopez P, et al. (2021). Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis. *Med Sci Sports Exerc* 53:1206–1216. PMC8126497
**Engine:** count sets of 6–30 reps at ≤3 RIR as hypertrophy-effective regardless of load. For the e1RM projection, weight sets by rep count: ≤10 reps → 1.0, 11–20 → 0.85, >20 → 0.7 [est]. Light dumbbells will push lower-body sets toward 20+ reps.

## 4. Frequency
**Claim:** frequency matters mainly as a way to distribute volume.
**Verdict: supported for hypertrophy.** Strength shows a small independent benefit from frequency.
**Numbers:** Schoenfeld 2016 (not volume-equated): 2×/wk ES 0.49 vs 1×/wk ES 0.30. Schoenfeld 2019 (25 volume-equated trials): no meaningful effect. Grgic 2018: strength ES 0.74, 0.82, 0.93 and 1.08 for 1, 2, 3 and 4+ days per week, but no effect when volume is equated. Pelland 2026: the frequency effect is "compatible with negligible" for hypertrophy and positive with diminishing returns for strength.
**Quote:** "resistance training frequency does not significantly or meaningfully impact muscle hypertrophy when volume is equated"
**Sources:** Schoenfeld BJ, Grgic J, Krieger J (2019). How many times per week should a muscle be trained to maximize muscle hypertrophy? *J Sports Sci* 37:1286–1295 (vuir.vu.edu.au/38370) · Grgic J, Schoenfeld BJ, Davies TB, et al. (2018). Effect of Resistance Training Frequency on Gains in Muscular Strength: A Systematic Review and Meta-Analysis. *Sports Med* 48:1207–1220. https://doi.org/10.1007/s40279-018-0872-x
**Engine:** train each muscle in at least 2 of the 3 sessions. Hypertrophy frequency multiplier is 1.0. Strength at 3×/wk gets 1.03× the 2×/wk value [est].

## 5. Rest intervals
**Claim:** longer rest (~2–3 min) beats short rest (~1 min).
**Verdict: partly supported.** For hypertrophy the benefit is small and levels off near 90 s. Rest matters more for trained lifters' strength.
**Numbers:** Singer 2024 (9 studies): small benefit of resting >60 s and no appreciable difference beyond 90 s. Schoenfeld 2016 (trained men): 3 min beat 1 min for 1RM and thigh thickness. Grgic 2018: in untrained people, short to moderate rest is enough for strength.
**Quote:** "small hypertrophic benefit to employing inter-set rest interval durations >60 s... did not detect appreciable differences in hypertrophy when resting >90 s".
**Sources:** Singer A, et al. (2024). Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. *Front Sports Act Living* 6:1429789. https://doi.org/10.3389/fspor.2024.1429789 · Schoenfeld BJ, Pope ZK, et al. (2016). Longer Interset Rest Periods Enhance Muscle Strength and Hypertrophy in Resistance-Trained Men. *J Strength Cond Res* 30:1805–1812. PMID 26605807
**Engine:** keep at least 90 s between sets for the same muscle; superset pairing achieves this. A set with less than 60 s of same-muscle rest gets 0.9 credit [est].

## 6. Supersets / time-efficient methods
**Claim:** supersets keep most of the stimulus per minute.
**Verdict: supported** for antagonist or upper/lower pairs.
**Numbers:** Zhang 2025 meta-analysis: similar repetitions and volume load in shorter sessions (efficiency SMD 1.74), with higher lactate and effort ratings. Burke 2025 RCT: same gains with sessions 36% shorter. Iversen 2021: supersets, drop sets and rest-pause roughly halve session time.
**Quote:** "reducing session duration without compromising training volume, muscle activation, perceived recovery, or chronic adaptations in maximal strength, strength endurance, and muscle hypertrophy."
**Sources:** Zhang X, Weakley J, Li H, Li Z, García-Ramos A (2025). Superset Versus Traditional Resistance Training Prescriptions: A Systematic Review and Meta-analysis... *Sports Med*. https://doi.org/10.1007/s40279-025-02176-8 · Iversen VM, Norum M, Schoenfeld BJ, Fimland MS (2021). No Time to Lift? Designing Time-Efficient Training Programs for Strength and Hypertrophy: A Narrative Review. *Sports Med* 51:2079–2095. https://doi.org/10.1007/s40279-021-01490-1
**Engine:** a superset set counts 1.0. Never pair two exercises that share a prime mover. Plan on 35–50% time savings.

## 7. Minimum effective dose
**Claim:** one hard set 2–3×/week produces meaningful strength gains.
**Verdict: supported.** Strongest data are in trained men; for the general population it is supported qualitatively.
**Numbers:** Androulakis-Korakakis 2020 (8–12 wk): one set 2–3×/wk raised 1RM by 12.1 kg overall (95% CI 8.2–16.0), squat +17.5 kg and bench +8.3 kg. Krieger 2009: 2–3 sets gave 46% more strength gain than 1 set. Nuzzo 2024: once-a-week and single-set training have the best support among minimal doses.
**Quote:** "...a single set of 6–12 repetitions with loads ranging from approximately 70–85% 1RM 2–3 times per week... can produce suboptimal, yet significant increases in SQ and BP 1RM strength".
**Sources:** Androulakis-Korakakis P, Fisher JP, Steele J (2020). The Minimum Effective Training Dose Required to Increase 1RM Strength in Resistance-Trained Men: A Systematic Review and Meta-Analysis. *Sports Med* 50:751–765. https://doi.org/10.1007/s40279-019-01236-0 · Nuzzo JL, et al. (2024). Resistance Exercise Minimal Dose Strategies for Increasing Muscle Strength in the General Population: an Overview. *Sports Med*. PMID 38509414
**Engine:** floor of 1 hard set per muscle in each of ≥2 sessions. At 2–3 sets/wk, project about 0.7× of the 10-set strength gain and 0.55× of the hypertrophy gain [model-derived].

## 8. Long muscle lengths / full ROM
**Claim:** training at long lengths or full ROM is at least as good.
**Verdict: partly supported.** Full ROM is at least as good as partial ROM. Long-length variants sometimes do better, but the whole-muscle effect is small.
**Numbers:** Wolf 2023: SMD 0.12 (95% CI −0.02 to 0.26) in favour of full ROM. Maeo 2021: seated leg curl grew the hamstrings +14% vs +9% for prone. Maeo 2023: overhead extension grew the triceps +19.9% vs ~+13.5–13.9% in a neutral arm position (sources disagree on the decimal). Pedrosa 2022: lengthened partials beat full ROM for distal quadriceps growth in untrained women.
**Quote:** "The main model revealed a trivial SMD (0.12; 95% CI: –0.02, 0.26) in favour of full ROM compared to partial ROM."
**Sources:** Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J (2023). Partial Vs Full Range of Motion Resistance Training: A Systematic Review and Meta-Analysis. *Int J Strength Cond* 3(1) (journal.iusca.org/index.php/Journal/article/view/182) · Maeo S, et al. (2021). Greater Hamstrings Muscle Hypertrophy but Similar Damage Protection after Training at Long versus Short Muscle Lengths. *Med Sci Sports Exerc*. https://doi.org/10.1249/MSS.0000000000002523
**Engine:** default to full ROM and prefer long-length exercises (RDL, deep goblet squat, overhead extension, incline curl). Projection multiplier stays 1.0, with no bonus.

## 9. Deloads
**Claim:** deloads can be reactive or scheduled.
**Verdict: unclear.** Nothing shows scheduled deloads help novices, and short breaks cost little.
**Numbers:** Coleman 2024 (trained lifters, 1 wk off mid-programme): same hypertrophy, slightly less lower-body strength. Untrained RCT (Sci Rep 2026): reduced-volume weeks 4 and 8 made no difference. Bell 2024 survey: athletes deload ~6 days every 5.6 ± 2.3 weeks. Bell 2023 Delphi: deloads can be pre-planned, autoregulated, or both.
**Quote:** "...appears to negatively influence measures of lower body muscle strength but has no effect on lower body hypertrophy..." (Coleman)
**Sources:** Coleman M, Burke R, Augustin F, et al. (2024). Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. *PeerJ* 12:e16777. https://doi.org/10.7717/peerj.16777 · Bell L, et al. (2023). Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach. *Sports Med Open* 9:87. https://doi.org/10.1186/s40798-023-00633-0
**Engine:** reactive deload when e1RM stalls on ≥2 lifts for 2 sessions or recovery is poor: half the sets, same load, RIR 3–4. Optional scheduled deload every 8–10 weeks. A deload week counts as 0.5 training week in projections [est].

## 10. Novices progress on almost anything; double progression
**Verdict: supported.**
**Numbers:** Currier 2023 (178 strength studies, n=5,097): every prescription beat control. Plotkin 2022: adding reps and adding load gave similar results (muscle thickness +6.7–12.9% in both groups; strength difference 2.0 kg with a CI crossing 0). ACSM 2009: raise the load 2–10% when the lifter exceeds the target by 1–2 reps in two consecutive sessions.
**Quote:** "All resistance training prescriptions were superior to control for muscle strength and hypertrophy".
**Sources:** Currier BS, et al. (2023). Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis. *Br J Sports Med*. https://doi.org/10.1136/bjsports-2023-106807 · Plotkin D, et al. (2022). Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. *PeerJ* 10:e14142. https://doi.org/10.7717/peerj.14142
**Engine:** double progression. Once every set hits the top of the rep range at ≤2 RIR in two consecutive sessions, move up the smallest dumbbell step. If that step is more than 10% of the load, add reps, sets or tempo first.

## 11. "Exercise snacks" / short frequent sessions
**Verdict: partly supported.** Splitting a matched weekly volume into shorter sessions is fine. Aerobic exercise snacks improve fitness. Evidence for very short resistance "snacks" is still emerging.
**Numbers:** Arazi 2021 (volume-equated): 4 sessions/wk raised upper-body 1RM more than 2 sessions/wk. Rodríguez 2025: exercise snacks improved cardiorespiratory fitness in inactive adults (g=1.37). Schoenfeld 2019: see #4.
**Quote:** "Exercise snacks significantly improved cardiorespiratory fitness in adults (g=1.37, 95% CI 0.58 to 2.17; p<0.005)."
**Sources:** Rodríguez MÁ, Quintana-Cepedal M, Cheval B, et al. (2025). Effect of exercise snacks on fitness and cardiometabolic health in physically inactive individuals: systematic review and meta-analysis. *Br J Sports Med*. https://doi.org/10.1136/bjsports-2025-110027 · Arazi H, et al. (2021). Effects of different resistance training frequencies on body composition and muscular performance adaptations in men. *PeerJ* 9:e10537. https://doi.org/10.7717/peerj.10537
**Engine:** allow 2×10-min splits with no penalty when weekly hard sets match. Snacks do not replace weekly volume.

## 12. RIR-based e1RM
**Verdict: partly supported.** Epley is reasonable at low to moderate reps. Self-rated RIR runs about one rep low and gets noisier further from failure.
**Numbers:** Halperin 2022: people underpredict reps to failure by 0.95 reps (95% CI 0.17–1.73); accuracy is better near failure and at ≤12 reps. Zourdos 2016: novices rated true 1RMs less accurately (RPE 8.96 vs 9.80). Reynolds 2006: predict 1RM from ≤10 reps. Nuzzo 2024: average reps of 4, 8 and 11 at 90%, 80% and 70% 1RM, vs 3.3, 7.5 and 12.9 implied by Epley.
**Quote:** "participants tended to underpredict the number of repetitions to task failure by 0.95 repetitions".
**Sources:** Halperin I, et al. (2022). Accuracy in Predicting Repetitions to Task Failure in Resistance Exercise: A Scoping Review and Exploratory Meta-analysis. *Sports Med* 52:377–390. https://doi.org/10.1007/s40279-021-01559-x · Nuzzo JL, Pinto MD, Nosaka K, Steele J (2024). Maximal Number of Repetitions at Percentages of the One Repetition Maximum... *Sports Med* 54:303–321. https://doi.org/10.1007/s40279-023-01937-7
**Engine:** e1RM = w·(1+(reps+RIRadj)/30), using only sets where reps+RIRadj ≤ 12. RIRadj is the reported RIR plus 1 when the reported value is 2–4 during the first 8 weeks, and plus 0.5 after that. Ignore sets with reported RIR ≥5. Smooth with an EWMA (α≈0.3) [est].

## 13. Lapsed lifters regain faster
**Verdict: supported** for regaining previous levels. Nothing shows faster gains beyond the previous peak.
**Numbers:** Staron 1991: 6 weeks of retraining restored what 20 weeks had built, about a 3× speed-up. Halonen 2024 (untrained, age 32 ± 5): after a 10-week break, the pre-break level came back in 5 weeks, about 2×. Seaborne 2018: lean mass rose more on reloading. Psilander 2019: retraining did not boost hypertrophy.
**Quote:** "after only five weeks of re-training, the pre-break level had already been reached." (University of Jyväskylä release on Halonen 2024)
**Sources:** Halonen EJ, et al. (2024). Does Taking a Break Matter—Adaptations in Muscle Strength and Size Between Continuous and Periodic Resistance Training. *Scand J Med Sci Sports* 34:e14739. https://doi.org/10.1111/sms.14739 · Staron RS, et al. (1991). Strength and skeletal muscle adaptations in heavy-resistance-trained women after detraining and retraining. *J Appl Physiol* 70:631–640. https://doi.org/10.1152/jappl.1991.70.2.631
**Engine:** speed-up factor 2.0 (range 1.5–3), applied only until the previous best is restored [est].

## 14. Sex differences
**Verdict: supported.**
**Numbers:** Roberts 2020: no sex difference in hypertrophy (ES 0.07, P=0.31) or lower-body strength (ES −0.21, P=0.20). Women gained more relative upper-body strength (ES −0.60 ± 0.16, P=0.002). Refalo 2025: relative growth differed by only 0.69% (95% HDI −1.50 to 2.88), while absolute growth favoured men (SMD 0.19).
**Quote:** "...similar effect sizes for hypertrophy and lower-body strength, but females had a larger effect for relative upper-body strength."
**Sources:** Roberts BM, Nuckols G, Krieger JW (2020). Sex Differences in Resistance Training: A Systematic Review and Meta-Analysis. *J Strength Cond Res* 34:1448–1460. https://doi.org/10.1519/JSC.0000000000003521 · Refalo MC, Nuckols G, Galpin AJ, et al. (2025). Sex differences in absolute and relative changes in muscle size following resistance training in healthy adults... *PeerJ* 13:e19042. PMID 40028215
**Engine:** multipliers on % change for women: hypertrophy 1.0, upper-body strength 1.3 [est from ES], lower-body strength 1.0.

## 15. Age
**Verdict: partly supported / unclear.** Relative strength gains largely hold up with age, and hypertrophy is modestly blunted. No paper quantifies 40–65 vs younger cleanly.
**Numbers:** Ahtiainen 2016 (n=287, ages 19–78, 20–24 wk): strength +21.1 ± 11.5%, muscle size +4.8 ± 6.1%, and "age and sex did not affect the RT responses". Peterson 2010 (age >50): strength +24–33% depending on the exercise. Peterson 2011: +1.1 kg lean body mass over about 20.5 wk, with less gain in older people.
**Quote:** "Meta-regression revealed that higher-volume interventions were associated with significantly greater increases in lean body mass, whereas older individuals experienced less increase." (Peterson 2011)
**Sources:** Ahtiainen JP, Walker S, et al. (2016). Heterogeneity in resistance training-induced muscle strength and mass responses in men and women of different ages. *Age* 38:10. PMC5005877 · Peterson MD, Sen A, Gordon PM (2011). Influence of resistance exercise on lean body mass in aging adults: a meta-analysis. *Med Sci Sports Exerc* 43:249–258. PMC2995836
**Engine:** multipliers on % gain: age 40–65 → 0.9 for hypertrophy and 1.0 for strength; age 65+ → 0.75 for hypertrophy and 0.85 for strength [est, low confidence].

---

## Appendix: sources behind priors.json not cited above
- **Strength, untrained:** Ahtiainen 2016 (above): leg-press 1RM +21.1 ± 11.5% (range −8 to +60%) after 20–24 weeks at 2×/wk; ~7% low responders for strength and ~30% for muscle size. ACSM (2009). Progression models in resistance training for healthy adults. *Med Sci Sports Exerc* 41:687–708, https://doi.org/10.1249/MSS.0b013e3181915670. It reports strength gains of "approximately 40% in untrained, 20% in moderately trained, 16% in trained, 10% in advanced" over 4 wk–2 yr, a figure seen via documents quoting it. Hubal MJ, et al. (2005). Variability in muscle size and strength gain after unilateral resistance training. *Med Sci Sports Exerc* 37:964–972, PMID 15947721: after 12 weeks of arm training, CSA +18.9 ± 9.7% and 1RM gains ranging 0 to +250%.
- **Lean mass:** Benito PJ, Cupeiro R, Ramos-Campo DJ, Alcaraz PE, Rubio-Arias JÁ (2020). A Systematic Review with Meta-Analysis of the Effect of Resistance Training on Whole-Body Muscle Growth in Healthy Adult Males. *IJERPH* 17:1285, https://doi.org/10.3390/ijerph17041285. Muscle mass "increased... by 1.53 kg (95% CI [1.30, 1.76])"; study durations ranged from 2 weeks to 1 year. Untrained men, 8 wk: lean body mass +1.0 to +1.5 kg (*J Strength Cond Res* 2021, PMID 31009427; authors not confirmed).
- **VO2max:** Bouchard C, et al. (1999). Familial aggregation of VO2max response to exercise training: HERITAGE. *J Appl Physiol* 87:1003–1008, PMID 10484570: about +400 mL/min (~17–18%) after 20 wk at 3×/wk, ranging from ~0 to >1 L/min. Milanović Z, Sporiš G, Weston M (2015). *Sports Med* 45:1469–1481, https://doi.org/10.1007/s40279-015-0365-0: +4.9 mL·kg⁻¹·min⁻¹ for continuous training and +5.5 for HIIT vs controls. Montero D, Lundby C (2017). *J Physiol* 595:3377–3387, https://doi.org/10.1113/JP273480: after 6 weeks, non-response was 69%, 40%, 29%, 0% and 0% at 1, 2, 3, 4 and 5 × 60 min/wk. Ramos-Campo DJ, et al. (2021). *Biology* 10:377, https://doi.org/10.3390/biology10050377: circuit resistance training raised VO2max by 6.3%.
- **12-minute test:** Cooper KH (1968). A means of assessing maximal oxygen intake. *JAMA* 203:201–204: r≈0.90 in 115 USAF men, VO2max = (m − 504.9)/44.73. Mayorga-Vega D, et al. (2016). *PLoS One* 11:e0151671, https://doi.org/10.1371/journal.pone.0151671: 12-minute test validity r = 0.78 (95% CI 0.72–0.83).
- **Lean body mass formula:** Boer P (1984). Estimated lean body mass as an index for normalization of body fluid volumes in humans. *Am J Physiol* 247:F632–F636, https://doi.org/10.1152/ajprenal.1984.247.4.F632. Coefficients were confirmed via secondary calculators, not the original PDF.
