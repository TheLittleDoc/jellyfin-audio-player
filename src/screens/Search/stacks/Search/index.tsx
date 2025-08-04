import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Input from '@/components/Input';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, View } from 'react-native';
import styled from 'styled-components/native';
import { useAppDispatch, useTypedSelector } from '@/store';
import Fuse, { IFuseOptions } from 'fuse.js';
import { Album, AlbumTrack } from '@/store/music/types';
import { FlatList } from 'react-native-gesture-handler';
import TouchableHandler from '@/components/TouchableHandler';
import { useNavigation } from '@react-navigation/native';
import { useGetImage } from '@/utility/JellyfinApi/lib';
import { t } from '@/localisation';
import useDefaultStyles, { ColoredBlurView } from '@/components/Colors';
import { searchAndFetchAlbums } from '@/store/music/actions';
import { debounce } from 'lodash';
import { Text } from '@/components/Typography';
import DownloadIcon from '@/components/DownloadIcon';
import ChevronRight from '@/assets/icons/chevron-right.svg';
import SearchIcon from '@/assets/icons/magnifying-glass.svg';
import { ShadowWrapper } from '@/components/Shadow';
import { NavigationProp } from '@/screens/types';
import { useNavigationOffsets } from '@/components/SafeNavigatorView';
import BaseAlbumImage from '@/screens/Music/stacks/components/AlbumImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import MicrophoneIcon from '@/assets/icons/microphone.svg';
// import AlbumIcon from '@/assets/icons/collection.svg';
// import TrackIcon from '@/assets/icons/note.svg';
// import PlaylistIcon from '@/assets/icons/note-list.svg';
// import StreamIcon from '@/assets/icons/cloud.svg';
// import LocalIcon from '@/assets/icons/internal-drive.svg';
// import SelectableFilter from './components/SelectableFilter';

const KEYBOARD_OFFSET = Platform.select({
    ios: 0,
    // Android 15+ has edge-to-edge support, changing the keyboard offset to 0
    android: Number.parseInt(Platform.Version as string) >= 35 ? 0 : 72,
});
const SEARCH_INPUT_HEIGHT = 62;

const Container = styled(View)`
    padding: 4px 24px 0 24px;
    margin-bottom: 0px;
    padding-bottom: 0px;
    border-top-width: 0.5px;
`;

const FullSizeContainer = styled.View`
    flex: 1;
`;

const Loading = styled.View`
    position: absolute;
    right: 12px;
    top: 0;
    height: 100%;
    flex: 1;
    justify-content: center;
`;

const AlbumImage = styled(BaseAlbumImage)`
    border-radius: 4px;
    width: 32px;
    height: 32px;
    margin-right: 10px;
`;

const HalfOpacity = styled.Text`
    opacity: 0.5;
    margin-top: 2px;
    font-size: 12px;
    flex: 1 1 auto;
`;

const SearchResult = styled.View`
    flex-direction: row;
    align-items: center;
    padding: 8px 32px;
    height: 54px;
`;

const fuseOptions: IFuseOptions<Album> = {
    keys: ['Name', 'AlbumArtist', 'AlbumArtists', 'Artists'],
    threshold: 0.1,
    includeScore: true,
    fieldNormWeight: 1,
};

type AudioResult = {
    type: 'Audio',
    id: string;
    album: string;
    name: string;
};

type AlbumResult = {
    type: 'AlbumArtist',
    id: string;
    album: undefined;
    name: undefined;
}

type CombinedResults = (AudioResult | AlbumResult)[];

export default function Search() {
    const defaultStyles = useDefaultStyles();
    const offsets = useNavigationOffsets({ includeOverlay: false });

    // Prepare state for fuse and albums
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setLoading] = useState(false);
    const [fuseResults, setFuseResults] = useState<CombinedResults>([]);
    const [jellyfinResults, setJellyfinResults] = useState<CombinedResults>([]);
    const albums = useTypedSelector(state => state.music.albums.entities);

    // Prepare helpers
    const navigation = useNavigation<NavigationProp>();
    const getImage = useGetImage();
    const dispatch = useAppDispatch();

    /**
     * Since it is impractical to have a global fuse variable, we need to
     * instantiate it for thsi function. With this effect, we generate a new
     * Fuse instance every time the albums change. This can of course be done
     * more intelligently by removing and adding the changed albums, but this is
     * an open todo.
     */
    const fuse = useMemo(() => (
        new Fuse(Object.values(albums) as Album[], fuseOptions)
    ), [albums]);

    /**
     * This function retrieves search results from Jellyfin. It is a seperate
     * callback, so that we can make sure it is properly debounced and doesn't
     * cause execessive jank in the interface.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchJellyfinResults = useCallback(debounce(async (searchTerm: string, currentResults: CombinedResults) => {
        // First, query the Jellyfin API
        const { payload } = await dispatch(searchAndFetchAlbums({ term: searchTerm }));

        // Convert the current results to album ids
        const albumIds = currentResults.map(item => item.id);

        // Parse the result in correct typescript form
        const results = (payload as { results: (Album | AlbumTrack)[] }).results;

        // Filter any results that are already displayed
        const items = results.filter(item => (
            !(item.Type === 'MusicAlbum' && albumIds.includes(item.Id))
        // Then convert the results to proper result form
        )).map((item) => ({
            type: item.Type,
            id: item.Id,
            album: item.Type === 'Audio'
                ? item.AlbumId
                : undefined,
            name: item.Type === 'Audio'
                ? item.Name
                : undefined,
        }));

        // Lastly, we'll merge the two and assign them to the state
        setJellyfinResults([...items] as CombinedResults);

        // Loading is now complete
        setLoading(false);
    }, 50), [dispatch, setJellyfinResults]);

    /**
     * Whenever the search term changes, we gather results from Fuse and assign
     * them to state
     */
    useEffect(() => {
        if (!searchTerm) {
            return;
        }

        const retrieveResults = async () => {
            // First set the immediate results from fuse
            const fuseResults = fuse.search(searchTerm);
            const albums: AlbumResult[] = fuseResults
                .map(({ item }) => ({ 
                    id: item.Id,
                    type: 'AlbumArtist',
                    album: undefined,
                    name: undefined,
                }));
            
            // Assign the preliminary results
            setFuseResults(albums);
            setLoading(true);
            try {
                // Wrap the call in a try/catch block so that we catch any
                // network issues in search and just use local search if the
                // network is unavailable
                fetchJellyfinResults(searchTerm, albums);
            } catch {
                // Reset the loading indicator if the network fails
                setLoading(false);
            }
        };

        retrieveResults();
    }, [searchTerm, setFuseResults, setLoading, fuse, fetchJellyfinResults]);

    // Handlers
    const selectAlbum = useCallback((id: string) => {
        navigation.navigate('Album', { id, album: albums[id] as Album });
    }, [navigation, albums]);

    const SearchInput = React.useMemo(() => (
        <Animated.View>
            <ColoredBlurView>
                <Container style={[ defaultStyles.border ]}>
                    <View>
                        <Input
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                            style={[defaultStyles.view, { marginBottom: 12 }]}
                            placeholder={t('search') + '...'}
                            icon={<SearchIcon width={14} height={14} fill={defaultStyles.textHalfOpacity.color} />}
                            testID="search-input"
                            autoCorrect={false}
                        />
                        {isLoading && <Loading style={{ marginTop: -4 }}><ActivityIndicator /></Loading>}
                    </View>
                </Container>
                {/* <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ paddingHorizontal: 32, paddingBottom: 12, flex: 1, flexDirection: 'row' }}>
                        <SelectableFilter
                            text="Artists"
                            icon={MicrophoneIcon}
                            active
                        />
                        <SelectableFilter
                            text="Albums"
                            icon={AlbumIcon}
                            active={false}
                        />
                        <SelectableFilter
                            text="Tracks"
                            icon={TrackIcon}
                            active={false}
                        />
                        <SelectableFilter
                            text="Playlist"
                            icon={PlaylistIcon}
                            active={false}
                        />
                        <SelectableFilter
                            text="Streaming"
                            icon={StreamIcon}
                            active={false}
                        />
                        <SelectableFilter
                            text="Local Playback"
                            icon={LocalIcon}
                            active={false}
                        />
                    </View>
                </ScrollView> */}
            </ColoredBlurView>
        </Animated.View>
    ), [searchTerm, setSearchTerm, defaultStyles, isLoading]);

    const searchResults = useMemo(() => ([
        ...fuseResults,
        ...jellyfinResults,
    ]), [fuseResults, jellyfinResults]);

    const insets = useSafeAreaInsets();
    
    return (
        <View style={{ flex: 1, paddingTop: insets.top, marginBottom: offsets.bottom }}>
            <KeyboardAvoidingView behavior="height" style={{ flex: 1 }} keyboardVerticalOffset={KEYBOARD_OFFSET}>
                <FlatList
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 2, }}
                    contentContainerStyle={{ paddingTop: offsets.top, paddingBottom: SEARCH_INPUT_HEIGHT }}
                    scrollIndicatorInsets={{ top: offsets.top  / 2, bottom: offsets.bottom / 2 + 10 + SEARCH_INPUT_HEIGHT }}
                    data={searchResults}
                    renderItem={({ item: { id, type, album: trackAlbum, name: trackName } }: { item: AlbumResult | AudioResult }) => {
                        const album = albums[trackAlbum || id];

                        // GUARD: If the album cannot be found in the store, we
                        // cannot display it.
                        if (!album) {
                            return null;
                        }

                        return (
                            <TouchableHandler<string> id={album.Id} onPress={selectAlbum} testID={`search-result-${album.Id}`}>
                                <SearchResult>
                                    <ShadowWrapper>
                                        <AlbumImage source={{ uri: getImage(album) }} style={defaultStyles.imageBackground} />
                                    </ShadowWrapper>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1}>
                                            {trackName || album.Name}
                                        </Text>
                                        {(album.AlbumArtist || album.Name) && (
                                            <HalfOpacity style={defaultStyles.text} numberOfLines={1}>
                                                {type === 'AlbumArtist' 
                                                    ? `${t('album')} • ${album.AlbumArtist}`
                                                    : `${t('track')} • ${album.AlbumArtist} — ${album.Name}`
                                                }
                                            </HalfOpacity>
                                        )}
                                    </View>
                                    <View style={{ marginLeft: 16 }}>
                                        <DownloadIcon trackId={id} />
                                    </View>
                                    <View style={{ marginLeft: 16 }}>
                                        <ChevronRight width={14} height={14} fill={defaultStyles.textQuarterOpacity.color}  />
                                    </View>
                                </SearchResult>
                            </TouchableHandler>
                        );
                    }}
                    keyExtractor={(item) => item.id}
                    extraData={[searchTerm, albums]}
                />
                {(searchTerm.length && !jellyfinResults.length && !fuseResults.length && !isLoading) ? (
                    <FullSizeContainer>
                        <Text style={{ textAlign: 'center', opacity: 0.5, fontSize: 18 }}>{t('no-results')}</Text> 
                    </FullSizeContainer>
                ) : null}
                {SearchInput}
            </KeyboardAvoidingView>
        </View>
    );
}