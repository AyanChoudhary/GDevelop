// @flow
import * as React from 'react';
import {
  enumerateObjectInstructions,
  enumerateInstructions,
  getObjectParameterIndex,
} from './InstructionOrExpressionSelector/EnumerateInstructions';
import {
  createTree,
  type InstructionOrExpressionTreeNode,
} from './InstructionOrExpressionSelector/CreateTree';
import {
  type EnumeratedInstructionOrExpressionMetadata,
  filterEnumeratedInstructionOrExpressionMetadataByScope,
} from './InstructionOrExpressionSelector/EnumeratedInstructionOrExpressionMetadata.js';
import { type EventsScope } from '../EventsScope.flow';
const gd = global.gd;

/** Helper to get the gdInstructionMetadata of an instruction. */
export const getInstructionMetadata = ({
  instructionType,
  isCondition,
  project,
}: {|
  instructionType: string,
  isCondition: boolean,
  project: gdProject,
|}): ?gdInstructionMetadata => {
  if (!instructionType) return null;

  return isCondition
    ? gd.MetadataProvider.getConditionMetadata(
        project.getCurrentPlatform(),
        instructionType
      )
    : gd.MetadataProvider.getActionMetadata(
        project.getCurrentPlatform(),
        instructionType
      );
};

type Parameters = {|
  project: gdProject,
  instruction: gdInstruction,
  isCondition: boolean,
  isNewInstruction: boolean,
  scope: EventsScope,
  globalObjectsContainer: gdObjectsContainer,
  objectsContainer: gdObjectsContainer,
|};

type NewInstructionEditorState = {|
  chosenObjectName: ?string,
  chosenObjectInstructionsInfo: ?Array<EnumeratedInstructionOrExpressionMetadata>,
  chosenObjectInstructionsInfoTree: ?InstructionOrExpressionTreeNode,
|};

type NewInstructionEditorSetters = {|
  chooseFreeInstruction: (
    type: string
  ) => {| ...NewInstructionEditorState, instruction: gdInstruction |},
  chooseObject: (
    objectName: string
  ) => {| ...NewInstructionEditorState, instruction: gdInstruction |},
  chooseObjectInstruction: (
    type: string
  ) => {| ...NewInstructionEditorState, instruction: gdInstruction |},
|};

const findInstruction = (
  list: Array<EnumeratedInstructionOrExpressionMetadata>,
  instructionType: string
): ?EnumeratedInstructionOrExpressionMetadata => {
  return list.find(({ type }) => type === instructionType);
};

/** React Hook handling the state of an instruction editor. */
export const useNewInstructionEditor = ({
  instruction,
  isCondition,
  project,
  isNewInstruction,
  scope,
  globalObjectsContainer,
  objectsContainer,
}: Parameters): [NewInstructionEditorState, NewInstructionEditorSetters] => {
  const getChosenObjectState = (
    objectName: string,
    discardInstructionTypeIfNotInObjectInstructions: boolean
  ): NewInstructionEditorState => {
    const chosenObjectInstructionsInfo = filterEnumeratedInstructionOrExpressionMetadataByScope(
      enumerateObjectInstructions(
        isCondition,
        globalObjectsContainer,
        objectsContainer,
        objectName
      ),
      scope
    );

    // As we changed to a new object, verify if the instruction is still valid for this object. If not,
    // discard the chosen instruction - this is to avoid the user creating invalid instructions.
    if (
      instruction.getType() &&
      discardInstructionTypeIfNotInObjectInstructions
    ) {
      const instructionMetadata = findInstruction(
        chosenObjectInstructionsInfo,
        instruction.getType()
      );
      if (!instructionMetadata) {
        instruction.setType('');
      }
    }

    return {
      chosenObjectName: objectName,
      chosenObjectInstructionsInfo,
      chosenObjectInstructionsInfoTree: createTree(
        chosenObjectInstructionsInfo
      ),
    };
  };

  const getInitialState = (): NewInstructionEditorState => {
    if (!isNewInstruction) {
      // Check if the instruction is an object/behavior instruction. If yes
      // select the object, which is the first parameter of the instruction.
      const allInstructions = enumerateInstructions(isCondition);
      const instructionType: string = instruction.getType();
      const enumeratedInstructionMetadata = findInstruction(
        allInstructions,
        instructionType
      );
      if (
        enumeratedInstructionMetadata &&
        (enumeratedInstructionMetadata.scope.objectMetadata ||
          enumeratedInstructionMetadata.scope.behaviorMetadata)
      ) {
        const objectParameterIndex = getObjectParameterIndex(
          enumeratedInstructionMetadata.metadata
        );
        if (objectParameterIndex !== -1) {
          return getChosenObjectState(
            instruction.getParameter(objectParameterIndex),
            false /* Even if the instruction is invalid for the object, show it as it's what we have already */
          );
        }
      }
    }

    // We're either making a new instruction or editing a free instruction.
    return {
      chosenObjectName: null,
      chosenObjectInstructionsInfo: null,
      chosenObjectInstructionsInfoTree: null,
    };
  };

  const [state, setState] = React.useState(getInitialState);

  const chooseObject = (objectName: string) => {
    const newState = getChosenObjectState(objectName, true);
    setState(newState);
    return {
      instruction,
      ...newState,
    };
  };

  const chooseObjectInstruction = (type: string) => {
    instruction.setType(type);
    if (state.chosenObjectName) {
      const newState = getChosenObjectState(state.chosenObjectName, true);
      setState(newState);
      return {
        instruction,
        ...newState,
      };
    }

    return {
      instruction,
      ...state,
    };
  };

  const chooseFreeInstruction = (type: string) => {
    instruction.setType(type);
    const newState = {
      chosenObjectName: null,
      chosenObjectInstructionsInfo: null,
      chosenObjectInstructionsInfoTree: null,
    };
    setState({
      chosenObjectName: null,
      chosenObjectInstructionsInfo: null,
      chosenObjectInstructionsInfoTree: null,
    });

    return {
      instruction,
      ...newState,
    };
  };

  return [
    state,
    {
      chooseFreeInstruction,
      chooseObject,
      chooseObjectInstruction,
    },
  ];
};
