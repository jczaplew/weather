import React, {useState, useEffect} from 'react';
import moment from 'moment';
import Forecast from './Forecast';
import CurrentConditions from './CurrentConditions';
import HourlyGraphs from './HourlyGraphs';
import {CtoF, parseIcon, distanceM, bearing} from './util';
import icons from './icons';
import {ForecastPeriod} from './types/ForecastPeriod';

export default function ForecastPage() {
    const [data, setData] = useState<any>({
        stationInfo: undefined,
        currentConditions: undefined,
        forecast: undefined,
        hourlyForecast: undefined,
    });
    const [lastRefresh, setLastRefresh] = useState<moment.Moment | undefined>(undefined);

    async function fetchData() {
        const LNG = -93.2054;
        const LAT = 44.9475;
        const {grid, station} = await fetchLocationInfo(LNG, LAT);

        const [stationInfo, currentConditions, forecast, hourlyForecast] = await Promise.all([
            await fetchStationInfo(station.id),
            await fetchCurrentConditions(station.id + '/observations/latest'),
            await fetchForecast(grid + '/forecast'),
            await fetchHourlyForecast(grid),
        ]);

        stationInfo.properties.distance = distanceM(
          [LNG, LAT],
          ((stationInfo.geometry.coordinates as any) as [number, number]),
        );

        stationInfo.properties.bearing = bearing(
          [LNG, LAT],
          ((stationInfo.geometry.coordinates as any) as [number, number]),
        );

       setData({stationInfo, currentConditions, forecast, hourlyForecast});
       setLastRefresh(moment());
    }

    useEffect(() => {
        fetchData();

        // If the user puts the page in the background and comes back >= 5 minutes later, refresh
        document.addEventListener('visibilitychange', () => {
            const sinceLastRefresh = moment.duration(moment().diff(lastRefresh));
            if (sinceLastRefresh.asMinutes() >= 5) {
                fetchData();
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div className='App' style={{maxWidth: '1000px', margin: '0 auto', padding: '25px'}}>
        <CurrentConditions data={data.currentConditions} stationInfo={data.stationInfo}/>
        <Forecast data={data.forecast} />
        <HourlyGraphs data={data.hourlyForecast}/>
    </div>
}

async function fetchLocationInfo(lng: number, lat: number) {
  const pointInfo = await fetch(`https://api.weather.gov/points/${lat},${lng}`)
    .then(res => res.json());

  const station = await fetch(pointInfo.properties.observationStations)
    .then(res => res.json())
    .then(json => json.features[0]);

  return {
    grid: pointInfo.properties.forecastGridData,
    station,
  }
}

async function fetchStationInfo(url: string) {
  const response = await fetch('https://api.weather.gov/stations/KMSP')
    .then(res => res.json());

    return response;
}

async function fetchCurrentConditions(url: string) {
    const response = await fetch('https://api.weather.gov/stations/KMSP/observations/latest')
      .then(res => res.json())

    const parsedIcons = parseIcon(response.properties.icon);
    if (parsedIcons) {
      response.properties.icon = (icons as any)[parsedIcons[0]?.icon].icon;
    }

    response.properties['feelsLike'] = (
        response.properties.windChill.value || response.properties.heatIndex.value
    );
    return response.properties;
}

async function fetchForecast(url: string) {
    const response = await fetch(url)
      .then(res => res.json());

    const parsed = response.properties.periods
      .map((period: ForecastPeriod, idx: number) => {
        const temps = [
          period.temperature,
          ...(response.properties.periods[idx] ? [response.properties.periods[idx].temperature] : []),
          ...(response.properties.periods[idx + 1] ? [response.properties.periods[idx + 1].temperature] : [])
        ]

        const parsedIcon = parseIcon(period.icon)[0];
        const balmyIcon = (icons as any)[parsedIcon.icon];

        return {
          ...period,
          minTemp: Math.min(...temps),
          maxTemp: Math.max(...temps),
          precip: parsedIcon.percent,
          icon: balmyIcon.icon || period.icon,
        }
      });

     const days = parsed.map((day: ForecastPeriod) => {
        const night = parsed.filter(
          (period: ForecastPeriod) => {
            if (period.name === day.name + ' Night') return period;
            if (day.name === 'Today' && period.name === 'Tonight') return period;
            return false;
          }
        );

        return {
          ...day,
          night: night.length ? night[0] : undefined,
          shortForecast: day.shortForecast.split(' then ')[0],

        }
      }).filter((period: ForecastPeriod) => period.isDaytime);

    return days;
}


async function fetchHourlyForecast(url: string) {
    const hourly = await fetch(url)
        .then(res => res.json())
        .then(res => res.properties);

    // Convert windspeed from knots to mph
    hourly.windSpeed.data = hourly.windSpeed.values.map((d: any) => {
        return {
            ...d,
            x: moment(d.validTime.split('/')[0]).toDate(),
            y: Math.round(d.value * 1.15078),
        }
    });

    // Convert temp from C to F
    hourly.temperature.data = hourly.temperature.values.map((d: any) => {
        return {
            ...d,
            x: moment(d.validTime.split('/')[0]).toDate(),
            y: CtoF(d.value),
            value: CtoF(d.value),
        }
    });

    hourly.skyCover.data = hourly.skyCover.values.map((d: any) => {
        return {
            ...d,
            x: moment(d.validTime.split('/')[0]).toDate(),
            y: d.value,
        }
    });

    hourly.probabilityOfPrecipitation.data = hourly.probabilityOfPrecipitation.values.map((d: any) => {
        return {
            ...d,
            x: moment(d.validTime.split('/')[0]).toDate(),
            y: d.value,
        }
    });

    // Nivo needs an id
    hourly.windSpeed['id'] = 'windSpeed';
    hourly.skyCover['id'] = 'skyCover';
    hourly.temperature['id'] = 'temperature';
    hourly.probabilityOfPrecipitation['id'] = 'probabilityOfPrecipitation';

    return hourly;
}
