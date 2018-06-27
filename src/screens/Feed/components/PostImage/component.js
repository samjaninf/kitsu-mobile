import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { View, Image, Dimensions, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';
import { ImageSizeCache } from 'kitsu/utils/cache';
import { getImgixImage } from 'kitsu/utils/imgix';
import { isKitsuUrl, isGIFUrl } from 'kitsu/common/utils/url';
import { styles } from './styles';

// The maximum width to classify as a phone
const MAX_PHONE_WIDTH = 480;

// Change the auto height value based on device
const MAX_AUTO_HEIGHT = Dimensions.get('window').width > MAX_PHONE_WIDTH ? 400 : 325;

export class PostImage extends PureComponent {
  static propTypes = {
    uri: PropTypes.string.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    borderRadius: PropTypes.number,
    // The maximum height an image can be if the width is set and height is not set.
    maxAutoHeight: PropTypes.number,
  };

  static defaultProps = {
    width: null,
    height: null,
    borderRadius: 0,
    maxAutoHeight: MAX_AUTO_HEIGHT,
  };

  state = {
    width: this.props.width || 0,
    height: this.props.height || 0,
    autoHeight: false,
    loading: true,
  }

  componentWillMount() {
    this.mounted = true;
    this.fetchImageSize();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.uri !== nextProps.uri ||
        this.props.width !== nextProps.width ||
        this.props.height !== nextProps.height
    ) {
      this.fetchImageSize();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchImageSize() {
    const uri = this.props.uri;

    // Get the cached size first, if not then load it in
    if (ImageSizeCache.contains(uri)) {
      const size = ImageSizeCache.get(uri) || {};
      const imageSize = this.calculateSize(size.width, size.height, false);
      this.setState({
        loading: false,
        ...imageSize,
      });
    } else {
      const { originalWidth, originalHeight, loading } = this.state;
      const imageSize = this.calculateSize(originalWidth, originalHeight, loading);
      this.setState({ ...imageSize });

      // Remove this once FastImage fixes local image support and passes size in its `onLoad` event
      Image.getSize(uri, (width, height) => {
        if (!this.mounted) return;

        ImageSizeCache.set(uri, width, height);

        const newImageSize = this.calculateSize(width, height, false);
        this.setState({
          loading: false,
          ...newImageSize,
        });
      });
    }
  }

  mounted = false

  /*
  Calculate the size of the image.
  */
  calculateSize(originalWidth, originalHeight, loading) {
    const { maxAutoHeight, width: propWidth, height: propHeight } = this.props;

    const isWidthSet = !!propWidth;
    const isHeightSet = !!propHeight;

    // The max width to clip view if `width` is not set and `height` is set
    const maxAutoWidth = Dimensions.get('window').width;

    // Image ratio
    // These may not be set so we need to make sure we don't divide by 0
    const ratio = (originalHeight || 0) / (originalWidth || 1);

    // The default dimensions if we haven't finished loading the image
    const defaultWidth = propWidth || maxAutoWidth;
    const defaultHeight = propHeight || Math.min(defaultWidth / 2, maxAutoHeight);

    // Return values
    let width = 0;
    let height = 0;
    let autoHeight = false;

    // Calculate the possibilities
    if (isWidthSet && isHeightSet) {
      // User has set both width and height
      width = propWidth;
      height = propHeight;
    } else if (loading) {
      // If we haven't loaded the image then use default values
      width = defaultWidth;
      height = defaultHeight;
    } else if (isWidthSet && !isHeightSet) {
      // User has set the width but not the height
      width = propWidth;
      height = Math.min(maxAutoHeight, propWidth * ratio);
      autoHeight = true;
    } else if (!isWidthSet && isHeightSet) {
      // User has set the height but not the width
      width = Math.min(maxAutoWidth, propHeight * (1 / ratio));
      height = propHeight;
    } else {
      // User hasn't set the anything
      width = originalWidth || 0;
      height = originalHeight || 0;
    }

    return {
      width,
      height,
      autoHeight,
    };
  }

  render() {
    const { uri, borderRadius, maxAutoHeight } = this.props;
    const { loading, width, height, autoHeight } = this.state;

    const imgixUri = getImgixImage(uri, {
      w: width,
      h: height,
    }) || '';

    // We need to apply 'contain' to any non-kitsu url that has gove over maxAutoHeight
    // We don't need to do it for kitsu urls because imgix smart crops the image
    const isExternalUrl = !isKitsuUrl(uri);

    // Imgix doesn't work well with gifs so we we force it to use the original url
    const isGIF = isGIFUrl(uri);
    const imageUri = isGIF ? uri : imgixUri;

    // Check if images height is above max autoheight
    const isImageMaxAutoHeight = autoHeight && height >= maxAutoHeight;

    return (
      <View>
        {loading &&
          <View style={[styles.loadingContainer, { borderRadius }]}>
            <ActivityIndicator color="white" />
          </View>
        }
        <FastImage
          // If height is automatically set and it goes over the max auto height
          // We need to make sure that the image is displayed in full to the user.
          // Only applies to non-kitsu images or kitsu images which are gifs
          resizeMode={(isGIF || isExternalUrl) && isImageMaxAutoHeight ? 'contain' : 'cover'}
          source={{ uri: imageUri }}
          style={{
            width,
            height,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: loading ? 'transparent' : '#fcfcfc',
          }}
          cache="web"
        />
      </View>
    );
  }
}

export const PostImageSeparator = () => <View style={styles.separator} />;
