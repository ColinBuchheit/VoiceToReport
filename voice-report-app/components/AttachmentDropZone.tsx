// voice-report-app/components/AttachmentDropZone.tsx
// Modern file attachment component inspired by popular apps like Slack, Discord, Gmail
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Platform,
  Modal,
  Image,
  Dimensions,
  Linking,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useFontScale } from '../context/FontScaleContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types - NO base64 stored, only URI reference and metadata
export interface Attachment {
  uri: string;           // File URI on device
  name: string;          // Original filename
  size: number;          // File size in bytes
  mimeType: string;      // MIME type
  // base64 NOT stored - read only when sending email
}

interface AttachmentDropZoneProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Helper to get file icon based on mime type
const getFileIcon = (mimeType: string): keyof typeof Ionicons.glyphMap => {
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
  return 'attach-outline';
};

// Helper to get file type color
const getFileTypeColor = (mimeType: string, accentColor: string): string => {
  if (mimeType.startsWith('image/')) return '#10B981'; // Green for images
  if (mimeType === 'application/pdf') return '#EF4444'; // Red for PDFs
  if (mimeType.includes('word') || mimeType.includes('document')) return '#3B82F6'; // Blue for docs
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '#22C55E'; // Green for sheets
  return accentColor;
};

const AttachmentDropZone: React.FC<AttachmentDropZoneProps> = ({
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  maxSizeMB = 10,
}) => {
  const { colors, isDark } = useTheme();
  const { scaled } = useFontScale();
  const [isHovered, setIsHovered] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  
  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);
  
  // Document/PDF preview modal state
  const [previewDocument, setPreviewDocument] = useState<Attachment | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);

  // Pulse animation for drop zone
  const startPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.02, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const pickDocument = async () => {
    if (attachments.length >= maxFiles) {
      Alert.alert('Limit Reached', `You can attach up to ${maxFiles} files.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'application/vnd.ms-excel',
               'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments: Attachment[] = [];
        
        for (const asset of result.assets) {
          // Check file size
          const fileSizeMB = (asset.size || 0) / (1024 * 1024);
          if (fileSizeMB > maxSizeMB) {
            Alert.alert('File Too Large', `${asset.name} exceeds ${maxSizeMB}MB limit.`);
            continue;
          }

          // Check if already attached
          if (attachments.some(a => a.name === asset.name)) {
            continue;
          }

          // Store only metadata and URI - NO base64 reading here
          // base64 will be read only when sending email
          newAttachments.push({
            uri: asset.uri,
            name: asset.name,
            size: asset.size || 0,
            mimeType: asset.mimeType || 'application/octet-stream',
          });

          if (attachments.length + newAttachments.length >= maxFiles) break;
        }

        if (newAttachments.length > 0) {
          startPulse();
          onAttachmentsChange([...attachments, ...newAttachments]);
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const pickImage = async () => {
    if (attachments.length >= maxFiles) {
      Alert.alert('Limit Reached', `You can attach up to ${maxFiles} files.`);
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false, // Don't request base64 - we'll read it only when sending email
      });

      if (!result.canceled && result.assets) {
        const newAttachments: Attachment[] = [];

        for (const asset of result.assets) {
          const fileName = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
          const fileSize = asset.fileSize || 0;
          
          // Check file size
          const fileSizeMB = fileSize / (1024 * 1024);
          if (fileSizeMB > maxSizeMB) {
            Alert.alert('Image Too Large', `${fileName} exceeds ${maxSizeMB}MB limit.`);
            continue;
          }

          // Check if already attached
          if (attachments.some(a => a.uri === asset.uri)) {
            continue;
          }

          // Store only metadata and URI - NO base64 reading here
          newAttachments.push({
            uri: asset.uri,
            name: fileName,
            size: fileSize,
            mimeType: asset.mimeType || 'image/jpeg',
          });

          if (attachments.length + newAttachments.length >= maxFiles) break;
        }

        if (newAttachments.length > 0) {
          startPulse();
          onAttachmentsChange([...attachments, ...newAttachments]);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(updated);
  };

  // View/open an attachment - images show in modal, PDFs show in WebView, others open externally
  const viewAttachment = async (attachment: Attachment) => {
    try {
      console.log('📎 Viewing attachment:', attachment.name, 'mimeType:', attachment.mimeType);
      
      // Check if file still exists
      const fileInfo = await FileSystemLegacy.getInfoAsync(attachment.uri);
      
      if (!fileInfo.exists) {
        Alert.alert(
          'File Not Available',
          'This file is no longer available on your device. It may have been moved or deleted.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Determine if it's an image - check mimeType OR file extension
      const isImage = 
        attachment.mimeType?.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i.test(attachment.name);
      
      // Determine if it's a PDF
      const isPDF = 
        attachment.mimeType === 'application/pdf' || 
        /\.pdf$/i.test(attachment.name);
      
      console.log('📎 Is image?', isImage, 'Is PDF?', isPDF);

      // For images, show in a fullscreen modal preview
      if (isImage) {
        setPreviewImage(attachment);
        return;
      }
      
      // For PDFs, open directly with system PDF viewer (not share sheet)
      if (isPDF) {
        if (Platform.OS === 'android') {
          try {
            // Convert content:// URI to a file URI that can be opened
            // First, get a content URI that can be shared
            const contentUri = await FileSystemLegacy.getContentUriAsync(attachment.uri);
            
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: contentUri,
              flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
              type: 'application/pdf',
            });
          } catch (err) {
            console.error('IntentLauncher error:', err);
            // Fallback: try using Linking
            try {
              const contentUri = await FileSystemLegacy.getContentUriAsync(attachment.uri);
              const canOpen = await Linking.canOpenURL(contentUri);
              if (canOpen) {
                await Linking.openURL(contentUri);
              } else {
                Alert.alert('No PDF Viewer', 'No app is available to view PDFs. Please install a PDF viewer app.');
              }
            } catch (linkErr) {
              console.error('Linking error:', linkErr);
              Alert.alert('Cannot Open PDF', 'Unable to open this PDF file.');
            }
          }
        } else {
          // iOS - WebView can handle PDFs directly
          setDocumentLoading(true);
          setPreviewDocument(attachment);
        }
        return;
      }

      // For other documents, show a confirmation then open with external app
      Alert.alert(
        'Open Document',
        `Open "${attachment.name}" with another app?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: async () => {
              try {
                const isSharingAvailable = await Sharing.isAvailableAsync();
                if (isSharingAvailable) {
                  await Sharing.shareAsync(attachment.uri, {
                    mimeType: attachment.mimeType,
                  });
                } else {
                  Alert.alert('Cannot Open', 'No app available to open this file.');
                }
              } catch (err) {
                console.error('Failed to open document:', err);
                Alert.alert('Error', 'Failed to open the document.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error viewing attachment:', error);
      Alert.alert('Error', 'Failed to open the file.');
    }
  };

  const showPickerOptions = () => {
    Alert.alert(
      'Add Attachment',
      'Choose what to attach',
      [
        { text: 'Sign-off Document (PDF)', onPress: pickDocument },
        { text: 'Photo', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <Text style={[styles.sectionTitle, { 
        fontSize: scaled(18), 
        color: colors.textPrimary,
        borderBottomColor: colors.border 
      }]}>
        Insert Sign-off Attachment
      </Text>

      {/* Drop Zone */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[
            styles.dropZone,
            {
              backgroundColor: isDark ? colors.surfaceAlt : '#F8FAFC',
              borderColor: isHovered ? colors.accent : (isDark ? '#374151' : '#E2E8F0'),
              borderStyle: 'dashed',
            },
          ]}
          onPress={showPickerOptions}
          onPressIn={() => setIsHovered(true)}
          onPressOut={() => setIsHovered(false)}
          activeOpacity={0.8}
        >
          <View style={[styles.dropZoneIconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="cloud-upload-outline" size={32} color={colors.accent} />
          </View>
          <Text style={[styles.dropZoneTitle, { color: colors.textPrimary, fontSize: scaled(16) }]}>
            Tap to add sign-off documents
          </Text>
          <Text style={[styles.dropZoneSubtitle, { color: colors.textSecondary, fontSize: scaled(13) }]}>
            PDFs, Photos • Max {maxSizeMB}MB each
          </Text>
          
          {/* Quick action buttons */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[styles.quickActionBtn, { backgroundColor: colors.accent + '20' }]}
              onPress={pickDocument}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.accent} />
              <Text style={[styles.quickActionText, { color: colors.accent, fontSize: scaled(12) }]}>
                Sign-off Doc
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionBtn, { backgroundColor: '#10B981' + '20' }]}
              onPress={pickImage}
            >
              <Ionicons name="image-outline" size={18} color="#10B981" />
              <Text style={[styles.quickActionText, { color: '#10B981', fontSize: scaled(12) }]}>
                Photo
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Attached Files List - Vertical layout */}
      {attachments.length > 0 && (
        <View style={styles.attachmentsList}>
          <Text style={[styles.attachmentsCount, { color: colors.textSecondary, fontSize: scaled(12) }]}>
            {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
          </Text>
          <View style={styles.attachmentsVerticalList}>
            {attachments.map((file, index) => (
              <View
                key={`${file.name}-${index}`}
                style={[
                  styles.fileCardVertical,
                  {
                    backgroundColor: isDark ? colors.surface : '#FFFFFF',
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Tappable area for viewing file */}
                <TouchableOpacity
                  style={styles.fileCardTappable}
                  onPress={() => viewAttachment(file)}
                  activeOpacity={0.7}
                >
                  {/* File Icon */}
                  <View style={[
                    styles.fileIconContainer,
                    { backgroundColor: getFileTypeColor(file.mimeType, colors.accent) + '15' }
                  ]}>
                    <Ionicons
                      name={getFileIcon(file.mimeType)}
                      size={24}
                      color={getFileTypeColor(file.mimeType, colors.accent)}
                    />
                  </View>

                  {/* File Info */}
                  <View style={styles.fileInfo}>
                    <Text
                      style={[styles.fileName, { color: colors.textPrimary, fontSize: scaled(13) }]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {file.name}
                    </Text>
                    <Text style={[styles.fileSize, { color: colors.textSecondary, fontSize: scaled(11) }]}>
                      {formatFileSize(file.size)} • Tap to view
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Remove Button - separate from tappable area */}
                <TouchableOpacity
                  style={[styles.removeBtn, { backgroundColor: '#EF4444' + '15' }]}
                  onPress={() => removeAttachment(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* File count indicator */}
      {attachments.length > 0 && (
        <Text style={[styles.limitText, { color: colors.textSecondary, fontSize: scaled(11) }]}>
          {maxFiles - attachments.length} more file{maxFiles - attachments.length !== 1 ? 's' : ''} can be added
        </Text>
      )}

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewModalOverlay}>
          <TouchableOpacity 
            style={styles.previewModalClose}
            onPress={() => setPreviewImage(null)}
          >
            <View style={styles.previewCloseButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          {previewImage && (
            <View style={styles.previewImageContainer}>
              <Image
                source={{ uri: previewImage.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.previewImageInfo}>
                <Text style={styles.previewImageName} numberOfLines={1}>
                  {previewImage.name}
                </Text>
                <Text style={styles.previewImageSize}>
                  {formatFileSize(previewImage.size)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* PDF/Document Preview Modal with WebView */}
      <Modal
        visible={!!previewDocument}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setPreviewDocument(null)}
      >
        <SafeAreaView style={[styles.pdfModalContainer, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={[styles.pdfModalHeader, { backgroundColor: isDark ? '#111827' : '#F3F4F6', borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.pdfCloseButton}
              onPress={() => setPreviewDocument(null)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.pdfHeaderTitle}>
              <Text style={[styles.pdfFileName, { color: colors.textPrimary }]} numberOfLines={1}>
                {previewDocument?.name || 'Document'}
              </Text>
              {previewDocument && (
                <Text style={[styles.pdfFileSize, { color: colors.textSecondary }]}>
                  {formatFileSize(previewDocument.size)}
                </Text>
              )}
            </View>
            <View style={styles.pdfHeaderSpacer} />
          </View>

          {/* WebView Content */}
          <View style={styles.pdfWebViewContainer}>
            {documentLoading && (
              <View style={styles.pdfLoadingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.pdfLoadingText, { color: colors.textSecondary }]}>
                  Loading document...
                </Text>
              </View>
            )}
            {previewDocument && (
              <WebView
                source={
                  Platform.OS === 'android'
                    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(previewDocument.uri)}` }
                    : { uri: previewDocument.uri }
                }
                style={styles.pdfWebView}
                onLoadStart={() => setDocumentLoading(true)}
                onLoadEnd={() => setDocumentLoading(false)}
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('WebView error:', nativeEvent);
                  setDocumentLoading(false);
                  // For local files on Android, Google Docs won't work - fall back to external app
                  Alert.alert(
                    'Cannot Display PDF',
                    'Unable to display this PDF in-app. Would you like to open it with another app?',
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => setPreviewDocument(null) },
                      {
                        text: 'Open Externally',
                        onPress: async () => {
                          setPreviewDocument(null);
                          try {
                            const isSharingAvailable = await Sharing.isAvailableAsync();
                            if (isSharingAvailable && previewDocument) {
                              await Sharing.shareAsync(previewDocument.uri, {
                                mimeType: previewDocument.mimeType,
                              });
                            }
                          } catch (err) {
                            console.error('Failed to share:', err);
                          }
                        },
                      },
                    ]
                  );
                }}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                javaScriptEnabled={true}
                scalesPageToFit={true}
                startInLoadingState={true}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  dropZone: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropZoneTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  dropZoneSubtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  quickActionText: {
    fontWeight: '600',
  },
  attachmentsList: {
    marginTop: 16,
  },
  attachmentsCount: {
    marginBottom: 8,
    fontWeight: '500',
  },
  attachmentsVerticalList: {
    gap: 10,
  },
  attachmentsScroll: {
    gap: 12,
    paddingRight: 4,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fileCardVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontWeight: '500',
    marginBottom: 2,
  },
  fileSize: {
    fontWeight: '400',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCardTappable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitText: {
    marginTop: 8,
    textAlign: 'center',
  },
  // Image preview modal styles
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  previewCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  previewImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.7,
  },
  previewImageInfo: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 16,
  },
  previewImageName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewImageSize: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  // PDF/Document preview modal styles
  pdfModalContainer: {
    flex: 1,
  },
  pdfModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pdfCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfHeaderTitle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pdfFileName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pdfFileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  pdfHeaderSpacer: {
    width: 40,
  },
  pdfWebViewContainer: {
    flex: 1,
    position: 'relative',
  },
  pdfWebView: {
    flex: 1,
  },
  pdfLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  pdfLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

export default AttachmentDropZone;
