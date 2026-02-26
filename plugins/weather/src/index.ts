import type { Plugin } from '@agentbridgeai/core';
import { definePlugin } from '@agentbridgeai/sdk';
import { z } from 'zod';

const plugin: Plugin = definePlugin({
  name: 'weather',
  description: 'Get current weather and forecasts for any location worldwide',
  version: '0.1.0',
  actions: [
    {
      name: 'get_current_weather',
      description: 'Get the current weather conditions for a city including temperature, humidity, and description',
      parameters: z.object({
        city: z.string().describe('The city name, e.g. "London", "Lahore", "New York"'),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature units'),
      }),
      execute: async ({ city, units }) => {
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
          if (!res.ok) {
            return { success: false, message: `Could not fetch weather for "${city}". Please check the city name.` };
          }
          const data = await res.json();
          const current = data.current_condition?.[0];
          if (!current) {
            return { success: false, message: `No weather data available for "${city}".` };
          }

          const temp = units === 'fahrenheit' ? `${current.temp_F}°F` : `${current.temp_C}°C`;
          const feelsLike = units === 'fahrenheit' ? `${current.FeelsLikeF}°F` : `${current.FeelsLikeC}°C`;
          const desc = current.weatherDesc?.[0]?.value ?? 'Unknown';

          return {
            success: true,
            message: `Weather in ${city}: ${temp} (feels like ${feelsLike}), ${desc}. Humidity: ${current.humidity}%, Wind: ${current.windspeedKmph} km/h.`,
            data: {
              city,
              temperature: temp,
              feelsLike,
              description: desc,
              humidity: `${current.humidity}%`,
              wind: `${current.windspeedKmph} km/h`,
            },
          };
        } catch (error: any) {
          return { success: false, message: `Failed to get weather: ${error.message}` };
        }
      },
    },
    {
      name: 'get_forecast',
      description: 'Get a 3-day weather forecast for a city',
      parameters: z.object({
        city: z.string().describe('The city name'),
      }),
      execute: async ({ city }) => {
        try {
          const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
          if (!res.ok) {
            return { success: false, message: `Could not fetch forecast for "${city}".` };
          }
          const data = await res.json();
          const days = data.weather;
          if (!days || days.length === 0) {
            return { success: false, message: `No forecast data available for "${city}".` };
          }

          const forecast = days.map((day: any) => {
            const desc = day.hourly?.[4]?.weatherDesc?.[0]?.value ?? 'Unknown';
            return `${day.date}: ${day.mintempC}°C - ${day.maxtempC}°C, ${desc}`;
          }).join('\n');

          return {
            success: true,
            message: `3-day forecast for ${city}:\n${forecast}`,
            data: { city, days },
          };
        } catch (error: any) {
          return { success: false, message: `Failed to get forecast: ${error.message}` };
        }
      },
    },
  ],
});

export default plugin;
