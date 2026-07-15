// Supplemental OpenAPI CSV examples for routes whose handlers live outside
// analytics-routes.mjs. Kept in a dedicated module so parallel CSV PRs can add
// examples without contending on the csvExampleForRoute if-chain in contracts.mjs.
// Shared header/example for the two event-stream feeds (subnet + account), which
// serialize the same formatAccountEvent row shape.
const EVENTS_CSV_EXAMPLE = [
  "block_number,event_index,event_kind,hotkey,coldkey,netuid,uid,amount_tao,alpha_amount,observed_at,extrinsic_index",
  "8454388,3,StakeAdded,5Hotkey_sample,5Coldkey_sample,7,3,12.5,,2026-07-03T00:00:00.000Z,2",
].join("\r\n");

export const ROUTE_CSV_EXAMPLES = {
  "subnet-concentration-history": [
    "snapshot_date,neuron_count,stake_gini,stake_nakamoto_coefficient,stake_top_10pct_share,emission_gini,emission_nakamoto_coefficient,emission_top_10pct_share",
    "2026-06-27,2,0.490099,1,0.990099,0.409091,1,0.909091",
  ].join("\r\n"),
  "subnet-yield": [
    "uid,hotkey,role,stake_tao,emission_tao,yield,vs_median",
    "0,hk_sample,validator,1000,22.1,0.0221,above",
  ].join("\r\n"),
  "subnet-yield-history": [
    "snapshot_date,neuron_count,validator_count,yield_count,subnet_yield,mean_yield,median_yield,p25_yield,p75_yield,p90_yield",
    "2026-06-27,2,1,2,0.075,0.075,0.075,0.05,0.1,0.1",
  ].join("\r\n"),
  "subnet-performance-history": [
    "snapshot_date,neuron_count,validator_count,active_count,incentive_gini,incentive_nakamoto_coefficient,incentive_top_10pct_share,dividends_gini,dividends_nakamoto_coefficient,dividends_top_10pct_share,trust_mean,trust_median,consensus_mean,consensus_median,validator_trust_mean,validator_trust_median",
    "2026-06-27,2,1,2,0.490099,1,0.990099,0.409091,1,0.909091,0.82,0.82,0.75,0.75,0.9,0.9",
  ].join("\r\n"),
  // Each row is one full hyperparameter snapshot at one block (the entire
  // formatSubnetHyperparams shape flattened alongside the entry's own
  // block_number/observed_at/hyperparams_hash) -- see hyperparamsHistoryCsvRows
  // in workers/request-handlers/entities.mjs.
  "subnet-hyperparameters-history": [
    "block_number,observed_at,hyperparams_hash,kappa_ratio,immunity_period,min_allowed_weights,max_weight_limit_ratio,tempo,weights_version,weights_rate_limit,activity_cutoff,activity_cutoff_factor,registration_allowed,target_regs_per_interval,min_burn_tao,max_burn_tao,burn_half_life,burn_increase_mult,bonds_moving_avg_raw,max_regs_per_block,serving_rate_limit,max_validators,commit_reveal_period,commit_reveal_enabled,alpha_high_ratio,alpha_low_ratio,liquid_alpha_enabled,alpha_sigmoid_steepness,yuma_version,subnet_is_active,transfers_enabled,bonds_reset_enabled,user_liquidity_enabled,owner_cut_enabled,owner_cut_auto_lock_enabled,min_childkey_take_ratio",
    "8454388,2026-06-27T00:00:00.000Z,a1b2c3d4e5f6,0.18,4096,1,1,99,0,0,5000,0,true,1,0.001,0.01,0,1.5,0,1,50,64,0,false,0.3,0.1,false,,1,true,true,false,false,false,false,0.1",
  ].join("\r\n"),
  "subnet-events": EVENTS_CSV_EXAMPLE,
  "account-events": EVENTS_CSV_EXAMPLE,
  // The Postgres all-events feed: flat scalar columns of each raw pallet.method
  // event (the nested `args` object is omitted from the CSV projection).
  "chain-events-feed": [
    "block_number,event_index,pallet,method,phase,extrinsic_index,observed_at",
    "8454388,3,Balances,Transfer,ApplyExtrinsic,2,1751500800000",
  ].join("\r\n"),
  // The /chain/weights per-subnet weight-setting leaderboard rows.
  "chain-weights": [
    "netuid,distinct_setters,weight_sets,sets_per_setter",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/weights/setters network-wide weight-setter leaderboard rows.
  "chain-weight-setters": [
    "hotkey,netuid,uid,weight_sets,share,first_set_at,last_set_at",
    "5Grw_sample,,3,40,0.5714,2026-06-01T00:00:00.000Z,2026-06-07T00:00:00.000Z",
  ].join("\r\n"),
  // The /chain/serving per-subnet axon-serving leaderboard rows.
  "chain-serving": [
    "netuid,distinct_servers,announcements,announcements_per_server",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/prometheus per-subnet Prometheus-endpoint serving leaderboard rows.
  "chain-prometheus": [
    "netuid,distinct_exporters,announcements,announcements_per_exporter",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/axon-removals per-subnet axon-removal leaderboard rows.
  "chain-axon-removals": [
    "netuid,distinct_removers,removals,removals_per_remover",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/registrations per-subnet neuron-registration leaderboard rows.
  "chain-registrations": [
    "netuid,distinct_registrants,registrations,registrations_per_registrant",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/stake-moves per-subnet stake-movement (re-delegation) leaderboard rows.
  "chain-stake-moves": [
    "netuid,distinct_movers,movements,movements_per_mover",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/stake-transfers per-subnet stake-transfer (between-coldkeys) leaderboard rows.
  "chain-stake-transfers": [
    "netuid,distinct_senders,transfers,transfers_per_sender",
    "1,4,40,10",
  ].join("\r\n"),
  // The /chain/transfer-pairs top sender -> receiver corridors.
  "chain-transfer-pairs": [
    "from,to,volume_tao,transfer_count,last_block,last_observed_at",
    "5Sender_sample,5Receiver_sample,1250.5,42,8454388,2026-07-03T00:00:00.000Z",
  ].join("\r\n"),
  // The /chain/turnover per-subnet validator-churn leaderboard rows.
  "chain-turnover": [
    "netuid,validators_start,validators_end,validators_entered,validators_exited,validator_retention,stability_score",
    "1,64,60,8,12,0.8125,81",
  ].join("\r\n"),
};
