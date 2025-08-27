import React from 'react';
import {Modal, View, StatusBar} from 'react-native';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {DocumentViewer, DocumentViewerProps} from '../DocumentViewer';

export interface DocumentViewerModalProps extends Omit<DocumentViewerProps, 'onClose'> {
  visible: boolean;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = observer(
  ({visible, onClose, ...documentViewerProps}) => {
    const theme = useTheme();
    const styles = createStyles({theme});

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.surface} />
        <View style={styles.container}>
          <DocumentViewer
            {...documentViewerProps}
            onClose={onClose}
          />
        </View>
      </Modal>
    );
  }
);