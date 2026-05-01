# gtfs-validator-metrics-service

**Validates [GTFS Schedule](https://gtfs.org/documentation/schedule/reference/) datasets using the [official GTFS validator](https://github.com/MobilityData/gtfs-validator) and exposes the results as [Prometheus](https://prometheus.io/docs/concepts/data_model/)/[OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/metrics/) metrics.**


## Usage

```shell
docker run --rm -it \
	--name gtfs-validation-metrics-service \
	-p 3000:3000 \
	ghcr.io/mobidata-bw/gtfs-validation-metrics-service
```

Consume the metrics using [Prometheus](https://prometheus.io/) and the [multi-target exporter pattern](https://prometheus.io/docs/guides/multi-target-exporter/):

```yaml
scrape_configs:
- job_name: gtfs-validation-metrics-service
  scrape_interval: 12h
  scrape_timeout: 5m # depends on the GTFS feed, try it out first
  metrics_path: /probe
  static_configs:
    - labels:
        feed_id: 'some_agency'
      targets:
        - 'https://example.org/some-agency.gtfs.zip'
    - labels:
        feed_id: 'another_agency'
      targets:
        - 'https://example.org/another-agency.gtfs.zip'
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - target_label: __address__
      replacement: 'gtfs-validation-metrics-service.local:3000' # adapt to your architecture
```
