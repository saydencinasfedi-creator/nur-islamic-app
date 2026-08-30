
import { PrayerTimes, Location } from '../types';

export const fetchPrayerTimes = async (latitude: number, longitude: number, date: Date = new Date()): Promise<PrayerTimes | null> => {
    try {
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const response = await fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=3`); // Method 3: Muslim World League
        const data = await response.json();

        if (data.code === 200) {
            return data.data.timings;
        }
        return null;
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        return null;
    }
};

export const reverseGeocode = async (latitude: number, longitude: number): Promise<Location | null> => {
    try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const data = await response.json();

        return {
            city: data.city || data.locality || 'Unknown',
            country: data.countryName || 'Unknown',
            latitude,
            longitude
        };
    } catch (error) {
        console.error("Error fetching location name:", error);
        return null;
    }
};

export const forwardGeocode = async (city: string): Promise<Location | null> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            return {
                city: data[0].name || city, // Nominatim might return full display_name
                country: 'Unknown', // Nominatim country parsing can be complex, keeping simple for now or parsing from display_name
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error("Error geocoding city:", error);
        return null;
    }
};
