import React, { useState } from 'react';
import { View, StyleSheet, Modal, ScrollView } from 'react-native';
import { Text, TextInput, Button, IconButton, Portal } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { ErrorBoundary } from '../../context/ErrorBoundary';

interface CreateCourseModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
  communityId: string;
}

export function CreateCourseModal({ visible, onDismiss, onSuccess, communityId }: CreateCourseModalProps) {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    price: '',
  });
  const [sections, setSections] = useState<Array<{
    title: string;
    lessons: Array<{
      title: string;
      videoUri: string | null;
      description: string;
    }>;
  }>>([]);

  const handleAddSection = () => {
    setSections([...sections, { title: '', lessons: [] }]);
  };

  const handleAddLesson = (sectionIndex: number) => {
    const newSections = [...sections];
    newSections[sectionIndex].lessons.push({
      title: '',
      videoUri: null,
      description: '',
    });
    setSections(newSections);
  };

  const handleVideoSelect = async (sectionIndex: number, lessonIndex: number) => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission to access media library is required!');
        return;
      }

      // Launch picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const newSections = [...sections];
        newSections[sectionIndex].lessons[lessonIndex].videoUri = result.assets[0].uri;
        setSections(newSections);
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      alert('Failed to select video');
    }
  };

  const uploadVideo = async (uri: string): Promise<string> => {
    try {
      // Generate a unique filename
      const filename = `${Date.now()}.mp4`;
      const filePath = `course-videos/${filename}`;

      // Create FormData
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'video/mp4',
        name: filename,
      } as any);

      // Upload using fetch directly to Supabase storage
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const storageUrl = `${supabase.storageUrl}/object/course-content/${filePath}`;
      
      const response = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-content')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error(`Video upload failed: ${error.message}`);
    }
  };

  const handleCreate = async () => {
    if (!courseData.title.trim()) {
      alert('Please enter a course title');
      return;
    }

    setLoading(true);
    try {
      // Create course
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          title: courseData.title.trim(),
          description: courseData.description.trim(),
          community_id: communityId,
          price: parseFloat(courseData.price) || 0,
        })
        .select()
        .single();

      if (courseError) throw courseError;

      // Process sections sequentially
      for (const [sectionIndex, section] of sections.entries()) {
        if (!section.title.trim()) continue;

        // Create section
        const { data: sectionData, error: sectionError } = await supabase
          .from('course_sections')
          .insert({
            course_id: course.id,
            title: section.title.trim(),
            order_index: sectionIndex,
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        // Process lessons sequentially
        for (const [lessonIndex, lesson] of section.lessons.entries()) {
          if (!lesson.title.trim() || !lesson.videoUri) continue;

          try {
            // Upload video and get URL
            const videoUrl = await uploadVideo(lesson.videoUri);
            console.log('Video uploaded successfully:', videoUrl);

            // Create lesson with video URL
            const { error: lessonError } = await supabase
              .from('course_lessons')
              .insert({
                section_id: sectionData.id,
                title: lesson.title.trim(),
                description: lesson.description.trim(),
                video_url: videoUrl,
                order_index: lessonIndex,
                duration: 0, // You might want to get this from the video metadata
              });

            if (lessonError) throw lessonError;
          } catch (error) {
            console.error('Error processing lesson:', error);
            alert(`Failed to create lesson "${lesson.title}": ${error.message}`);
          }
        }
      }

      alert('Course created successfully!');
      onSuccess();
      onDismiss();
    } catch (error) {
      console.error('Error creating course:', error);
      alert(`Failed to create course: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Rest of the render code remains the same
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <ErrorBoundary>
          <View style={styles.container}>
            <View style={styles.header}>
              <IconButton icon="close" onPress={onDismiss} />
              <Text variant="headlineSmall">Create Course</Text>
              <Button
                mode="contained"
                onPress={handleCreate}
                loading={loading}
                disabled={loading || !courseData.title.trim()}
              >
                Create
              </Button>
            </View>

            <ScrollView style={styles.content}>
              <TextInput
                label="Course Title"
                value={courseData.title}
                onChangeText={(text) => setCourseData({ ...courseData, title: text })}
                style={styles.input}
              />

              <TextInput
                label="Description"
                value={courseData.description}
                onChangeText={(text) => setCourseData({ ...courseData, description: text })}
                multiline
                numberOfLines={3}
                style={styles.input}
              />

              <TextInput
                label="Price"
                value={courseData.price}
                onChangeText={(text) => setCourseData({ ...courseData, price: text })}
                keyboardType="numeric"
                style={styles.input}
              />

              {sections.map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                  <TextInput
                    label={`Section ${sectionIndex + 1} Title`}
                    value={section.title}
                    onChangeText={(text) => {
                      const newSections = [...sections];
                      newSections[sectionIndex].title = text;
                      setSections(newSections);
                    }}
                    style={styles.input}
                  />

                  {section.lessons.map((lesson, lessonIndex) => (
                    <View key={lessonIndex} style={styles.lesson}>
                      <TextInput
                        label={`Lesson ${lessonIndex + 1} Title`}
                        value={lesson.title}
                        onChangeText={(text) => {
                          const newSections = [...sections];
                          newSections[sectionIndex].lessons[lessonIndex].title = text;
                          setSections(newSections);
                        }}
                        style={styles.input}
                      />

                      <TextInput
                        label="Lesson Description"
                        value={lesson.description}
                        onChangeText={(text) => {
                          const newSections = [...sections];
                          newSections[sectionIndex].lessons[lessonIndex].description = text;
                          setSections(newSections);
                        }}
                        multiline
                        style={styles.input}
                      />

                      <Button
                        mode="outlined"
                        onPress={() => handleVideoSelect(sectionIndex, lessonIndex)}
                        icon={lesson.videoUri ? "check" : "video"}
                        style={styles.videoButton}
                      >
                        {lesson.videoUri ? 'Video Selected' : 'Select Video'}
                      </Button>
                    </View>
                  ))}

                  <Button
                    mode="outlined"
                    onPress={() => handleAddLesson(sectionIndex)}
                    icon="plus"
                    style={styles.addButton}
                  >
                    Add Lesson
                  </Button>
                </View>
              ))}

              <Button
                mode="outlined"
                onPress={handleAddSection}
                icon="plus"
                style={styles.addButton}
              >
                Add Section
              </Button>
            </ScrollView>
          </View>
        </ErrorBoundary>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 8,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  content: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  section: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  lesson: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  addButton: {
    marginTop: 8,
  },
  videoButton: {
    marginTop: 8,
  },
});