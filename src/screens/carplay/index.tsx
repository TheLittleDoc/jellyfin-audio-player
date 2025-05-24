import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { CarPlay, ListTemplate, ListItem } from 'react-native-carplay';

const CarPlayScreen: React.FC = () => {
    useEffect(() => {
        console.log('CarPlay: Screen mounted');

        const onConnect = () => {
            console.log('CarPlay: React Native connected');

            // Create a list template with some items
            const template = new ListTemplate({
                title: 'Fintunes',
                sections: [
                    {
                        header: 'Library',
                        items: [
                            {
                                text: 'Songs',
                                detailText: 'Browse your music library',
                            },
                            {
                                text: 'Albums',
                                detailText: 'Browse your albums',
                            },
                            {
                                text: 'Artists',
                                detailText: 'Browse your artists',
                            },
                        ],
                    },
                ],
                onItemSelect: (item) => {
                    console.log('Selected item:', item);
                },
            });

            // Set the template as root
            CarPlay.setRootTemplate(template);
        };

        const onDisconnect = () => {
            console.log('CarPlay: React Native disconnected');
        };

        // Register for CarPlay connection events
        CarPlay.registerOnConnect(onConnect);
        CarPlay.registerOnDisconnect(onDisconnect);

        return () => {
            console.log('CarPlay: Screen unmounting');
            // Cleanup listeners
            CarPlay.unregisterOnConnect(onConnect);
            CarPlay.unregisterOnDisconnect(onDisconnect);
        };
    }, []);

    return null;
};

export default CarPlayScreen; 