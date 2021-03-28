import React, {useMemo} from 'react';
import dayjs from 'dayjs';
import Highcharts, {Options, Chart} from 'highcharts';
import HighchartsReact from 'highcharts-react-official'
import {CtoF} from './util';
import {BalmyForecast} from './types/ForecastPeriod';

export default function TemperatureGraph({day}: {day: BalmyForecast}) {
    const temperatures = day.hourlyTemp.map((d: any) =>
        [dayjs(d.validTime.split('/')[0]).valueOf(), CtoF(d.value)]
    );

    const callback = useMemo(() => {
        return (chart: Chart) => {
            console.log('addEvent')
            Highcharts.addEvent(chart.container, 'mouseover', (event: PointerEvent) => {
                if (!event) return;
                for (let i = 0; i < Highcharts.charts.length; i++) {
                    const chart = Highcharts.charts[i];
                    if (!chart) continue;
                    // Find coordinates within the chart
                    const coord = chart.pointer.normalize(event);
                    // Get the hovered point
                    chart.series.forEach((s: any) => {
                        const point: Highcharts.Point = s.searchPoint(coord, true);
                        if (point) {
                            point.select(true, true);
                        } else {
                            s.select(false);
                        }
                    })

                }
            })
        }
    }, []);

    const temperatureOptions: Options = {
        chart: {
            type: 'areaspline',
            height: 250,
            marginLeft: 35,
        },
        time: {
            useUTC: false,
        },
        legend: {
            enabled: false,
        },
        title: {
            text: undefined,
        },
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats : {
                hour: '%H',
            },
            labels: {
                format: '{value:%H}'
            },
            plotLines: [{
                color: '#aaaaaa',
                value: dayjs().valueOf(),
                width: 1,
                zIndex: 2,
            }],
            max: dayjs(temperatures[0][0]).endOf('day').add(4, 'hours').valueOf(),
        },
        yAxis: {
            title: {
                text: undefined,
            },
            endOnTick: false,
            tickInterval: 5,
            min: Math.min(...temperatures.map((d: any) => d[1])) - 5,
            max: Math.max(...temperatures.map((d: any) => d[1])) + 5,
        },
        tooltip: {
            shared: true,
            formatter: function() {
                return `${this.y}°F @ ${dayjs(this.x).format('h A')}`
            }
        },
        credits: {
            enabled: false
        },
        plotOptions: {
            areaspline: {
                fillOpacity: 0.5,
                marker: {
                    enabled: false,
                },
            },
        },
        series: [{
            name: 'Temperature',
            type: 'areaspline',
            data: temperatures      ,
            color: '#ff8833',
        }]
    };

    return <HighchartsReact
        highcharts={Highcharts}
        options={temperatureOptions}
        // callback={callback}
    />

}